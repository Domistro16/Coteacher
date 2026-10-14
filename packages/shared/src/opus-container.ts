/** Ogg Opus container (RFC 7845). Granule positions always use 48 kHz samples. */
export const maxRecordingBytes = 20_000_000;
function crc(bytes: Uint8Array): number {
  let value = 0;
  for (const byte of bytes) {
    value ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) value = (value << 1) ^ (value & 0x80000000 ? 0x04c11db7 : 0);
  }
  return value >>> 0;
}
const ascii = (value: string) => new TextEncoder().encode(value);
export class OpusContainer {
  private pages: Uint8Array<ArrayBuffer>[] = [];
  private pending: Uint8Array[] = [];
  private sequence = 0;
  private granule = 0;
  private preSkip = 312;
  private bytes = 0;
  private serial = crypto.getRandomValues(new Uint32Array(1))[0];
  private page(packets: Uint8Array[], granule: number, flags: number) {
    const lace = packets.flatMap(packet => [...Array(Math.floor(packet.length / 255)).fill(255), packet.length % 255]);
    if (lace.length > 255) throw new Error('Audio packet page is too large.');
    const page = new Uint8Array(27 + lace.length + packets.reduce((sum, packet) => sum + packet.length, 0));
    const view = new DataView(page.buffer);
    page.set(ascii('OggS')); page[5] = flags; view.setBigUint64(6, BigInt(granule), true);
    view.setUint32(14, this.serial, true); view.setUint32(18, this.sequence++, true);
    page[26] = lace.length; page.set(lace, 27);
    let offset = 27 + lace.length;
    for (const packet of packets) { page.set(packet, offset); offset += packet.length; }
    view.setUint32(22, crc(page), true); this.pages.push(page); this.bytes += page.length;
    if (this.bytes > maxRecordingBytes) throw new Error('Recording exceeded the 20 MB device-transfer budget. This attempt cannot be published.');
  }
  add(packet: Uint8Array, durationUs: number, description?: AllowSharedBufferSource) {
    if (!this.sequence) {
      if (!description) throw new Error('This encoder did not expose its Opus delay header. Complete synchronized recording is unavailable in this browser.');
      const head = (ArrayBuffer.isView(description)
        ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
        : new Uint8Array(description)).slice();
      if (new TextDecoder().decode(head.subarray(0, 8)) !== 'OpusHead' || head.length !== 19 || head[9] !== 1) throw new Error('The encoder did not produce supported mono Opus.');
      this.preSkip = new DataView(head.buffer).getUint16(10, true);
      this.page([head], 0, 2);
      const tag = new Uint8Array(23); tag.set(ascii('OpusTags')); new DataView(tag.buffer).setUint32(8, 7, true); tag.set(ascii('Teacher'), 12);
      this.page([tag], 0, 0);
    }
    this.pending.push(packet); this.granule += Math.round(durationUs * 48 / 1000);
    // Leave at least one packet for an EOS page with the original sample duration.
    if (this.pending.length > 25) {
      const last = this.pending.pop()!;
      this.page(this.pending, this.granule - Math.round(durationUs * 48 / 1000), 0); this.pending = [last];
    }
  }
  finish(samples: number, sampleRate: number): Uint8Array<ArrayBuffer> {
    const end = this.preSkip + Math.round(samples * 48000 / sampleRate);
    if (!this.pending.length || end > this.granule) throw new Error('Audio encoder ended before the complete recording.');
    this.page(this.pending, end, 4);
    const result = new Uint8Array(this.bytes); let offset = 0;
    for (const page of this.pages) { result.set(page, offset); offset += page.length; }
    return result;
  }
}

/** Validate page checksums, framing and exact EOS duration; not speech/source verification. */
export function checkOpusContainer(bytes: Uint8Array<ArrayBuffer>, durationMs: number): boolean {
  if (bytes.length > maxRecordingBytes || bytes.length < 90) return false;
  let offset = 0, sequence = 0, serial = 0, skip = 0, ended = false, previous = 0, audioPages = 0;
  while (offset < bytes.length) {
    if (ended || offset + 27 > bytes.length) return false;
    const count = bytes[offset + 26];
    const payloadOffset = offset + 27 + count;
    if (payloadOffset > bytes.length) return false;
    const end = payloadOffset + bytes.subarray(offset + 27, payloadOffset).reduce((sum, size) => sum + size, 0);
    if (end > bytes.length) return false;
    const page = bytes.slice(offset, end), view = new DataView(page.buffer);
    if (new TextDecoder().decode(page.subarray(0, 4)) !== 'OggS' || page[4] !== 0 || (page[5] & 1) || view.getUint32(18, true) !== sequence) return false;
    const checksum = view.getUint32(22, true); view.setUint32(22, 0, true); if (crc(page) !== checksum) return false;
    const currentSerial = view.getUint32(14, true); if (sequence && serial !== currentSerial) return false; serial = currentSerial;
    const granule = Number(view.getBigUint64(6, true));
    const data = bytes.subarray(payloadOffset, end);
    if (!sequence) {
      if (page[5] !== 2 || data.length !== 19 || new TextDecoder().decode(data.subarray(0, 8)) !== 'OpusHead' || data[8] !== 1 || data[9] !== 1 || data[18] !== 0 || granule !== 0) return false;
      skip = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(10, true);
    } else if (sequence === 1) {
      if (new TextDecoder().decode(data.subarray(0, 8)) !== 'OpusTags' || granule !== 0) return false;
    } else {
      if (!data.length || granule < previous) return false;
      audioPages++;
    }
    if (page[5] & 4) { ended = true; if (Math.floor((granule - skip) / 48) !== durationMs) return false; }
    previous = granule; sequence++; offset = end;
  }
  return ended && audioPages > 0;
}
