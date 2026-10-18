const player = () => ({ play() {}, pause() {}, seekTo: async () => {}, remove() {}, replace() {}, volume: 1, loop: false, muted: false, currentTime: 0 });
module.exports = { createAudioPlayer: player, setAudioModeAsync: async () => {}, setIsAudioActiveAsync: async () => {}, useAudioPlayer: player };
