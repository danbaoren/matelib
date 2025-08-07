Rules:

1. Use Logger from matelib/modules/logger.ts to log instead of using console.log (Logger.log()).

2. example component, use this as working reference:

import * as RE from 'rogue-engine';

@RE.registerComponent
export default class myComponent extends RE.Component {


  @RE.props.group("Basic Props", true) // omit second argument for a non-foldable group.
  @RE.props.num() num = 0;
  @RE.props.num(0, 1) slider = 0.5;
  @RE.props.checkbox() toggleSomething = true;
  @RE.props.text() textInput = "";
  @RE.props.text(true) textArea = ``;

  @RE.props.group("Assets", true)
  @RE.props.object3d() hierarchyObj: THREE.Object3D;
  @RE.props.prefab() prefab: RE.Prefab;
  @RE.props.material() mat: THREE.Material;
  @RE.props.audio() sound: THREE.Audio;
  @RE.props.audio(true) positionalSound: THREE.PositionalAudio;
  @RE.props.animation() clip: THREE.AnimationClip;
  @RE.props.texture() texture: THREE.Texture;

  @RE.props.group("Others", true)
  @RE.props.data() serializeThis = {prop: "Hello World"};
  @RE.props.component(ComponentClass) myComponent: ComponentClass;
  @RE.props.code("html") inlineCodeEditor = ``; // options: "json" | "html" | "glsl"
  @RE.props.vector2() vector2 = new THREE.Vector2();
  @RE.props.vector3() vector3 = new THREE.Vector3();

  // Creates a Button that performs the given function when pressed.
  @RE.props.button() doSomething = () => {/*Do Stuff*/};
  // The label of the Button is set in a prop with the word "Label" added to its name.
  doSomethingLabel = "Do Something";

  // Creates a dropdown, the number represents the index in the list of values.
  @RE.props.select() dropdown = 0;
  // The array of values is defined in a prop with the word "Options" added to its name.
  dropdownOptions = ["option1", "option2"];

  // Creates a list with any of the previous decorators
  @RE.props.list.object3d() objects: THREE.Object3D[] = [];

  // Creates a key/value list with any of the previous decorators
  @RE.props.map.num() values: Record<string, number> = {};


  awake() {

  }

  start() {

    //use this to remove all runtime elements and clean resources
    // custom ui, event listeners, assets
    RE.Runtime.scene.onStop( () => {

    })

  }

  update() {

  }
}

3. dont mismatch RE.Runtime.scene and Re.App.currentScene == app is for engine developing and runtime for active running game/app.

4. use RE.Runtime.rogueDOMContainer for example for mouse interactions like for object transforms
