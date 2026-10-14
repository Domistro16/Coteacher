/* Native microphone audio only. No speech recognition, network or speaker monitoring. */
class TeacherAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.finished = false;
    this.frames = 0;
    this.buffer = new Float32Array(4096);
    this.used = 0;
    this.port.onmessage = ({ data }) => {
      if (this.finished) return;
      if (data.type === 'start' || data.type === 'resume') this.active = true;
      if (data.type === 'pause') { this.active = false; this.flush(); }
      if (data.cue) this.port.postMessage({ type: 'cue', cue: { ...data.cue, offsetMs: Math.floor(this.frames * 1000 / sampleRate) } });
      if (data.type === 'stop') this.stop();
      else if (data.type !== 'cue') this.port.postMessage({ type: 'state', state: this.active ? 'recording' : 'paused', offsetMs: Math.floor(this.frames * 1000 / sampleRate) });
    };
  }
  flush() {
    if (!this.used) return;
    const chunk = this.buffer.slice(0, this.used);
    this.port.postMessage({ type: 'chunk', chunk, offsetMs: Math.floor(this.frames * 1000 / sampleRate) }, [chunk.buffer]);
    this.used = 0;
  }
  stop() {
    this.active = false;
    this.finished = true;
    this.flush();
    this.port.postMessage({ type: 'stopped', offsetMs: Math.floor(this.frames * 1000 / sampleRate) });
  }
  process(inputs) {
    if (this.finished) return false;
    const input = inputs[0]?.[0];
    if (!this.active || !input) return true;
    const remaining = Math.min(input.length, Math.round(sampleRate * 21600) - this.frames);
    for (let i = 0; i < remaining; i++) {
      this.buffer[this.used++] = input[i];
      this.frames++;
      if (this.used === this.buffer.length) this.flush();
    }
    if (this.frames >= Math.round(sampleRate * 21600)) this.stop();
    // All output buffers remain zero: microphone never plays through speakers.
    return !this.finished;
  }
}
registerProcessor('teacher-audio-capture', TeacherAudioCapture);
