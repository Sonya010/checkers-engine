import { Rules } from '../types.js';

export const ukrainianRules: Rules = Object.freeze({
  id: 'ukrainian',
  boardSize: 8,
  firstMover: 'white',
  menCaptureBackward: true,
  kingsFly: true,
  captureChoice: 'any',
  promotionDuringCapture: 'continue-as-king',
  draw: Object.freeze({
    repetitionCount: 3,
    kingMovesWithoutCaptureLimit: 15,
    endgame: Object.freeze({
      enabled: true,
      singleKingVsOneKingLimit: 15,
      singleKingVsTwoOrFewerLimit: 5,
    }),
  }),
});
