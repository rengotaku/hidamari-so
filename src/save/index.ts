export {
  SAVE_KEY,
  SCHEMA_VERSION,
  SPEEDS,
  type Speed,
  MAX_CATCHUP_MINUTES,
  saveGame,
  loadGame,
  loadOrNew,
  catchUp,
  type KeyValueStorage,
  type LoadedGame,
  type OpenedGame,
} from "./storage";
export { createAwayTracker, type AwayTracker } from "./away";
