import * as RE from 'rogue-engine';
import { Debug } from '../../modules/Debug';

@RE.registerComponent
export default class debugcomp extends RE.Component {
  start() {
      Debug.init(true);
  }
}
