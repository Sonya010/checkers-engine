import { Rules } from '../types.js';

export const englishRules: Rules = Object.freeze({
  id: 'english',
  boardSize: 8,
  firstMover: 'black',
  menCaptureBackward: false,
  kingsFly: false,
  captureChoice: 'any',
  promotionDuringCapture: 'ends-move',
  draw: Object.freeze({
    repetitionCount: 3,
    kingMovesWithoutCaptureLimit: 40,
    endgame: Object.freeze({
      enabled: false,
      singleKingVsOneKingLimit: 40,
      singleKingVsTwoOrFewerLimit: 40,
    }),
  }),
});
