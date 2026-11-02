import type { Page } from '@playwright/test';

/** Constant synthetic tone through the real recorder/encoder graph. This does
 * not verify a physical microphone, human speech quality or actual classroom audio. */
export async function installSyntheticMicrophone(page: Page) {
  await page.addInitScript(() => {
    if (!['4273', '4274'].includes(location.port)) return;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const permissionStream = await capture(constraints);
      if (!constraints?.audio) return permissionStream;
      const audio = new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain(), destination = audio.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      gain.gain.value = .08;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      const stream = destination.stream, track = stream.getAudioTracks()[0], stop = track.stop.bind(track);
      let stopped = false;
      track.stop = () => {
        if (stopped) return;
        stopped = true;
        stop();
        permissionStream.getTracks().forEach(input => input.stop());
        oscillator.stop();
        void audio.close();
      };
      return stream;
    };
  });
}
