export { drawScene } from "./scene";
export {
  drawCloseup,
  closeupPlacements,
  closeupBubbleAnchor,
  lightOf,
  type LightMode,
} from "./closeup";
export { drawStage, type ViewFrame, type Scratch } from "./view";
export { createAmbient, updateAmbient, ambientRng, type Ambient } from "./ambient";
export { hitTest, bubbleAnchor, toScene, roomAt, residentOfRoom, type Hit } from "./hit";
