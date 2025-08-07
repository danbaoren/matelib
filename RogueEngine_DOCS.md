# Rogue Engine API Reference for AI

**Instructions for AI:**

This document contains a structured reference for the Rogue Engine API. Use it to answer questions and generate code for the Rogue Engine.

* **Structure:** The document is organized by classes and modules. Each entry contains a description, properties, and methods.
* **Code Generation:** When generating code, use the provided method signatures and examples. Pay close attention to the types and parameters.

---

## Class: Component

A component adds functionality to an `Object3D`. An object can have multiple components, but an instance of a component can be directly related to only one `Object3D`.

The `Component` class defines the behavior of a component. You need to extend from this class to create your own components. You should never call the Component's methods directly; they are to be called exclusively by the Engine.

When creating a component through the editor's interface (`Assets -> Component`), a component will be created with the standard template.

In the following example, we have a component `MyComponent` which extends the class `Component`. After defining it, we register it. If it's not registered, the component won't be accessible.

```typescript
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

  }

  update() {

  }
}


```

### Constructor

#### Method Signature

```typescript
constructor(name: string, object3d: THREE.Object3D)
```

The `Component` class constructor takes a `name` string and an `Object3D` as parameters. The `Object3D` will be assigned to the `Component.object3d` property. After instantiating a component, you need to add it with the engine's `addComponent()` function; otherwise, the component will be on standby.

In the following example, we import our component `MyComponent` and use the `getObjectByName` method on the `Runtime.scene` object. Then we instantiate the component and add it to the engine's component map with `addComponent`. This cues the engine to start executing its behavior methods in the next cycle.

```typescript
import { addComponent, App } from 'rogue-engine';
import { MyComponent } from './MyComponent'

// ...
const object3d = Runtime.scene.getObjectByName("MyObject");
const component = new MyComponent("MyComponentName", object3d);

addComponent(component);
// ...
```

### Static Methods

#### `static get()`

##### Method Signature

```typescript
static get<T>(this: {new (...args: any[]): T}): T
static get<T>(this: {new (...args: any[]): T}, object3d: Object3D): T
static get<T>(this: {new (...args: any[]): T}, object3d: Object3D, inAncestor?: boolean): T
static get<T>(this: {new (...args: any[]): T}, name: string, object3d?: Object3D): T
static get<T>(this: {new (...args: any[]): T}, name: string, object3d: Object3D, inAncestor?: boolean): T
```

Retrieves a component of the same class. You can pass in the object containing the component and whether you want to look for it in an ancestor. Alternatively, you can pass in the name first. This method is now preferred over `RE.getComponent()` or `RE.getComponentByName()`.

**Example**

```typescript
ComponentClass.get() // Finds the first component of this type
ComponentClass.get(this.object3d) // Finds the component in this.object3d
ComponentClass.get(this.object3d, true) // Finds the component in this.object3d or its ancestors
ComponentClass.get("MyComponent") // Finds the component of this class with the name "MyComponent"
ComponentClass.get("MyComponent", this.object3d) // Finds the component of this class with the name "MyComponent" in this.object3d
ComponentClass.get("MyComponent", this.object3d, true) // Finds the component of this class with the name "MyComponent" in this.object3d or its ancestors
```

#### `@ComponentClass.require()`

##### Method Signature

```typescript
static require(inAncestor?: boolean);
static require(name: string, inAncestor?: boolean);
```

Use this decorator on a property to set it to a component in the same object or an ancestor. This helps ensure access to the given component without needing to retrieve it later.

**Example**

```typescript
@ComponentClass.require()
someComponent: ComponentClass;

@AnotherComponent.require(true) // Find it in an ancestor
anotherComponent: AnotherComponent;

@MyComponent.require("Hello") // Find it by name
myComponent: MyComponent;

@MyComponent.require("YourComponent", true) // Find by name in an ancestor
yourComponent: MyComponent;
```

### Properties

#### `RE.props`

##### Property Signature

```typescript
props: Props
```

You can use decorators to provide a graphic interface for your component properties within the editor. To do this, you need to fetch the decorators from `RE.props`. This object contains all available decorators, each showing a specific graphic interface for different property types.

Here's a detailed list of all possible decorators:

```typescript
import * as RE from 'rogue-engine';
import * as THREE from 'three';

class MyComponent extends RE.Component {
  // Every prop below group() will be inside a group until you open the next one.
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
}
```

##### Organizing Props

You can use `@RE.props.group()` to visually organize properties in the inspector.

```typescript
  @RE.props.text() outside = "This prop is outside the group"

  // Every prop below group() will be inside a foldable group until you open the next one.
  @RE.props.group("My Foldable Group", true)
  @RE.props.text() insideFoldable = "This is inside the foldable group";
  @RE.props.list.text() insideList = ["This list prop is also", "inside the group"];

  // Here we're starting a new group.
  @RE.props.group("My Static Group")
  @RE.props.text() insideStaticGroup = "This is inside the static group";
  @RE.props.list.text() listInsideStatic = ["This list prop is also", "inside the group"];

  // Since I didn't include a name, this group is a line separator
  @RE.props.group("")
  @RE.props.num() numProp = 420; // This prop is below the line separator.
```

#### `.name`

##### Property Signature

```typescript
name: string
```

The name of the component. This can be used as an identifier to retrieve it with the `getComponentByName` function.

#### `static interface`

##### Property Signature

```typescript
static interface: ComponentInterface
```

The static `interface` object defines the graphic interface of our component. This is handled in the background by the property decorators, so for most cases, it's encouraged to use decorators instead.

This property has a `ComponentInterface` type, which maps a property name with a string describing the property's type:

```typescript
type ComponentInterface = {
  [propName: string]:
    | "String"
    | "Number"
    | "Boolean"
    | "Vector3"
    | "Vector2"
    | "Select"
    | "Object3D"
    | "Prefab"
    | "Texture"
    | "Material"
    | "Color"
    | "Audio"
    | "PositionalAudio";
}
```

Each of these options will display a different type of property controller in the Component inspector. `propName` must be a valid public property within the component.

**Example**

```typescript
import * as RE from 'rogue-engine';

export class MyComponent extends RE.Component {
  speed: number;

  static interface: RE.ComponentInterface = {
    speed: 'Number'
  }
  // ...
}
```

#### `.object3d`

##### Property Signature

```typescript
readonly object3d: THREE.Object3D
```

This is the `Object3D` to which this component belongs.

#### `.isReady`

##### Property Signature

```typescript
readonly isReady: boolean
```

This property returns the ready state of the component. A component is considered ready when all assets declared in its `interface` property are loaded.

A component that is not ready will only execute the `awake` method. As soon as the component is ready, its `start` method will be executed, and it will join the next update cycle.

When using the component from another script, you should check this property to ensure the assets are loaded before using them. You can safely use them in all methods of the component they belong to, with the exception of its `awake` method.

### Methods

All of the following methods are meant to be overridden. They should be declared within your component class if you need them. They will be called internally by the engine, and you should never call them directly in your code.

#### `.awake()`

##### Method Signature

```typescript
awake(): void
```

If the scene is not running, the `awake` methods of all components are called by the engine right before the first render. If the scene is running, this method is called immediately after the component is initialized.

#### `.start()`

##### Method Signature

```typescript
start(): void
```

If the scene is not running, the `start` methods of all components are called by the engine right after the first render. If the scene is running, this method is called as soon as the `isReady` property returns `true`.

#### `.beforeUpdate()`

##### Method Signature

```typescript
beforeUpdate(): void
```

This method is called by the engine just before the `update` method. It defines the very beginning of every frame for a component and should be used for things that need to be available before all `update` methods are executed.

#### `.update()`

##### Method Signature

```typescript
update(): void
```

This method is called by the engine just after `beforeUpdate` and right before `afterUpdate`. This is where you might, for example, move objects in your scene. This is called every frame, so keep your code efficient.

#### `.afterUpdate()`

##### Method Signature

```typescript
afterUpdate(): void
```

This method is called by the engine just after `update` and marks the end of every cycle of the animation loop. This is where you add things that need to happen after all `update` methods have been called.

#### `.onBeforeRemoved()`

##### Method Signature

```typescript
onBeforeRemoved(): void
```

This method is executed when `removeComponent` is called with this component as a parameter, just before it's removed from the components map.

#### `.onRemoved()`

##### Method Signature

```typescript
onRemoved(): void
```

This method is executed when `removeComponent` is called with this component as a parameter, right after it has been removed from the components map and the scene.

#### `.onBeforeObjectRemoved()`

##### Method Signature

```typescript
onBeforeObjectRemoved(): void
```

This method is executed just before the `remove` method for the `Object3D` to which this component belongs is called.

#### `.onObjectRemoved()`

##### Method Signature

```typescript
onObjectRemoved(): void
```

This method is executed right after the `remove` method for the `Object3D` to which this component belongs is called.

---

## Class: Prefab

A Prefab is a predefined `Object3D` that we store in a `.roguePrefab` file along with all components associated to the object itself or its children.

An instance of this class provides the information to load a Prefab and the means to instantiate it.

The class includes some static members to allow the loading dynamic loading of Prefabs.

### Static Members

#### `static namedPrefabUUIDs`

##### Member Signature

```typescript
static namedPrefabUUIDs: Record<string, string>;
```

A map of all prefab uuids with their paths relative to `Assets/Prefabs/` as keys. We refer to this relative path as the "name path" and all Prefabs in `Assets/Prefabs/` as "Named Prefabs". A name path does not include the `.roguePrefab` extension.

#### `static instantiate()`

##### Member Signature

```typescript
static instantiate(name: string): Promise<THREE.Object3D<THREE.Object3DEventMap>>;
```

Asynchronously instatiate a prefab within `Assets/Prefabs/`, by their "name path", or relative path to the Prefabs folder, excluding the `.roguePrefab` extension. This will fetch the prefab, including all its dependencies and instantiate it in your current scene.

**Example:**

```typescript
async start() {
  // Location: Assets/Prefabs/MyPrefab.roguePrefab
  const instance = await RE.Prefab.instantiate("MyPrefab");

  // Location: Assets/Prefabs/Enemies/Nemesis.roguePrefab
  const nemesis = await RE.prefab.instantiate("Enemies/Nemesis");
}
```

#### `static fetch()`

##### Member Signature

```typescript
static fetch(name: string): Promise<Prefab>;
```

Asynchronously fetch a prefab within `Assets/Prefabs/`, by their "name path", or relative path to the Prefabs folder, excluding the `.roguePrefab` extension.

**Example:**

```typescript
async start() {
  // Location: Assets/Prefabs/Enemies/Nemesis.roguePrefab
  const nemesisPrefab = await RE.prefab.fetch("Enemies/Nemesis");
  const instance = nemesisPrefab.instantiate();
}
```

#### `static get()`

##### Member Signature

```typescript
static get(name: string): Prefab;
```

Synchronously fetch a prefab within `Assets/Prefabs/`, by their "name path", or relative path to the Prefabs folder, excluding the `.roguePrefab` extension. This is useful when your Prefab is set to "preload" in the AssetManager and you know for a fact that it's immediately accessible in memory.

**Example:**

```typescript
start() {
  // Location: Assets/Prefabs/Enemies/Nemesis.roguePrefab
  const nemesisPrefab = RE.prefab.get("Enemies/Nemesis");
  const instance = nemesisPrefab.instantiate();
}
```

### Properties

#### `.uuid`

##### Property Signature

```typescript
readonly uuid: string;
```

The unique identifier for the Prefab.

#### `.path`

##### Property Signature

```typescript
readonly path: string;
```

The current path to the Prefab file.

#### `.name`

##### Property Signature

```typescript
readonly name: string;
```

The name of the Prefab.

### Methods

#### `.instantiate()`

##### Method Signature

```typescript
instantiate(parent?: THREE.Object3D): THREE.Object3D;
```

This method instantiates the Prefab either directly into the Scene. Optionally, you can pass in an `Object3D` as the parent.

**Example:**

```typescript
@RE.props.prefab() myPrefab: RE.Prefab;

start() {
  const instance = this.myPrefab.instantiate();
}
```

---

## Class: SceneController

The `SceneController` is an abstract class, so it should never be directly instantiated. This class defines the life cycle of a Scene and its components. The `Runtime` and `editorRuntime` both extend this class to implement functionality related to the scene when it's being played, and the scene when it's being edited respectively.

### Properties

#### .scene

##### Property Signature

```typescript
readonly scene: THREE.Scene
```

The `Scene` instance that is currently running.

#### .camera

##### Property Signature

```typescript
camera: THREE.Camera
```

The `Camera` instance that's currently "showing" us the scene.

#### .deltaTime

##### Property Signature

```typescript
readonly deltaTime: number
```

This value represents the seconds elapsed between the last frame and the current one.

#### .clock

##### Property Signature

```typescript
readonly clock: THREE.Clock
```

The three.js `Clock` being used to keep track of time.

#### .height

##### Property Signature

```typescript
readonly height: number
```

This value represents the height of the Scene Renderer.

#### .width

##### Property Signature

```typescript
readonly width: number
```

This value represents the width of the Scene Renderer.

#### .rogueDOMContainer

##### Property Signature

```typescript
readonly rogueDOMContainer: HTMLElement
```

This property keeps a reference to the current `HTMLElement` where the scene is being rendered.

#### .containerId

##### Property Signature

```typescript
readonly containerId: string
```

This field contains the id of the `HTMLElement` where the Scene is being rendered.

#### .renderer

##### Property Signature

```typescript
readonly renderer: THREE.WebGLRenderer
```

The active `WebGLRenderer`.

#### .isRunning

##### Property Signature

```typescript
readonly isRunning: boolean
```

This flag tells us if the `SceneController` is running the animation loop or not.

#### .isPaused

##### Property Signature

```typescript
readonly isPaused: boolean
```

This flag tells us if the `SceneController` is paused. Pausing will only stop `beforeUpdate()`, `update()`, and `afterUpdate()` from running along with their respective event listeners, but not the loop itself, so keep that in mind.

#### .defaultRenderFunc

##### Property Signature

```typescript
readonly defaultRenderFunc: () => void
```

This keeps a reference to the default render function that is called on every frame.

#### .renderFunc

##### Property Signature

```typescript
renderFunc: () => void
```

This is the render function being called every frame. By default it calls `defaultRenderFunc`. By setting this property you can modify the behavior of the renderer to apply post-production effects among other things.

#### .resolution

##### Property Signature

```typescript
resolution?: number;
```

Sets the maximum screen width before we start scaling the renderer's pixel ratio. The lower the resolution, the higher the performance. If set to `0` or `undefined` the resolution is let free.

#### .aspectRatio

##### Property Signature

```typescript
aspectRatio?: number;
```

Fixes the aspect ratio of the canvas container. If set to `0` or `undefined` the aspect ratio is let free.

#### .useAspectRatio

##### Property Signature

```typescript
useAspectRatio: boolean;
```

This makes the aspect ratio visible in the current `Runtime`. It's used by the editor to preview the aspect ratio in edit mode.

### Methods

#### .pause()

##### Method Signature

```typescript
pause(): void
```

This method will pause the animation loop if it's running.

#### .resume()

##### Method Signature

```typescript
resume(): void
```

This method will resume the animation loop if it's paused.

#### .togglePause()

##### Method Signature

```typescript
togglePause(): void
```

This handy method will toggle between `pause()` and `resume()`.

#### .setFullscreen()

##### Method Signature

```typescript
setFullscreen(): void;
```

Requests the browser to set the container div full screen.

### Events

#### .onPlay

##### Event Signature

```typescript
onPlay(callback: () => any): {stop: () => void}
```

This event listener helps us hook into the initialization sequence of this `SceneController` instance. It returns an object with a `stop()` function you should call in order to stop the listener.

#### .onStop

##### Event Signature

```typescript
onStop(callback: () => any): {stop: () => void}
```

This event listener helps us hook into the stopping sequence of this `SceneController` instance. It returns an object with a `stop()` function you should call in order to stop the listener.

---

## Module: Events

This document provides a reference for the event listeners available in the Rogue Engine API.

### `onObjectAdded`

#### Event Signature

```typescript
onObjectAdded(callback: (object: THREE.Object3D, target: THREE.Object3D) => void): {stop: () => void}
```

This event listener takes a callback function to be executed when `Object3D.add(object)` is called. The callback receives the added object and the target object as parameters.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event when it's no longer needed.

**Example**

```typescript
import { onObjectAdded } from 'rogue-engine';

// ...

const listener = onObjectAdded((object, target) => {
  console.log('Object added:', object.name, 'to', target.name);
});

// To stop listening:
// listener.stop();
```

### `onObjectRemoved`

#### Event Signature

```typescript
onObjectRemoved(callback: (object: THREE.Object3D, target: THREE.Object3D) => void): {stop: () => void}
```

This event listener takes a callback function to be executed when `Object3D.remove(object)` is called. The callback receives the removed object and the target object as parameters.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onObjectRemoved } from 'rogue-engine';

// ...

const listener = onObjectRemoved((object, target) => {
  console.log('Object removed:', object.name, 'from', target.name);
});

// To stop listening:
// listener.stop();
```

### `onComponentAdded`

#### Event Signature

```typescript
onComponentAdded(callback: (component: Component, target: THREE.Object3D) => void): {stop: () => void}
```

This event listener takes a callback function to be executed when `addComponent(component)` is called. The callback receives the added component and the target object as parameters.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onComponentAdded } from 'rogue-engine';

// ...

const listener = onComponentAdded((component, target) => {
  console.log('Component added:', component.constructor.name, 'to', target.name);
});

// To stop listening:
// listener.stop();
```

### `onComponentRemoved`

#### Event Signature

```typescript
onComponentRemoved(callback: (component: Component, target: THREE.Object3D) => void): {stop: () => void}
```

This event listener takes a callback function to be executed when `removeComponent(component)` is called. The callback receives the removed component and the target object as parameters.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onComponentRemoved } from 'rogue-engine';

// ...

const listener = onComponentRemoved((component, target) => {
  console.log('Component removed:', component.constructor.name, 'from', target.name);
});

// To stop listening:
// listener.stop();
```

### `onBeforeUpdate`

#### Event Signature

```typescript
onBeforeUpdate(callback: (sceneController: SceneController) => void): {stop: () => void}
```

This listener executes a callback function during the `beforeUpdate()` event of any active `SceneController`. This applies to both the editor and runtime animation loops. The callback receives the `SceneController` instance that fired the event.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onBeforeUpdate } from 'rogue-engine';

// ...

const listener = onBeforeUpdate((sceneController) => {
  // Runs in the beforeUpdate event of both editor and engine runtimes.
});

// To stop listening:
// listener.stop();
```

### `onUpdate`

#### Event Signature

```typescript
onUpdate(callback: (sceneController: SceneController) => void): {stop: () => void}
```

This listener executes a callback function during the `update()` event of any active `SceneController`. This applies to both the editor and runtime animation loops. The callback receives the `SceneController` instance that fired the event.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onUpdate } from 'rogue-engine';

// ...

const listener = onUpdate((sceneController) => {
  // Runs in the update event of both editor and engine runtimes.
});

// To stop listening:
// listener.stop();
```

### `onAfterUpdate`

#### Event Signature

```typescript
onAfterUpdate(callback: (sceneController: SceneController) => void): {stop: () => void}
```

This listener executes a callback function during the `afterUpdate()` event of any active `SceneController`. This applies to both the editor and runtime animation loops. The callback receives the `SceneController` instance that fired the event.

**Note:** Remember to call the `stop()` function on the returned object to stop listening to this event.

**Example**

```typescript
import { onAfterUpdate } from 'rogue-engine';

// ...

const listener = onAfterUpdate((sceneController) => {
  // Runs in the afterUpdate event of both editor and engine runtimes.
});

// To stop listening:
// listener.stop();
```

### `onNextFrame`

#### Event Signature

```typescript
onNextFrame(callback: (sceneController: SceneController) => void): void
```

This listener executes a callback function once on the next frame. The callback receives the `SceneController` instance that fired the event.

**Example**

```typescript
import { onNextFrame } from 'rogue-engine';

// ...

onNextFrame((sceneController) => {
  // This will run on the very next frame.
});
```

---

## Module: Tags

This class is is in charge of managing tags. Tags are a simple way to classify objects in our project.

For instance, you could have a "human" tag, to identify a human character, and a "player" tag to identify well, that, a player.

You could have some objects with both the "human" and "player" tags to define them as "human players".

### Methods

#### .getTags()

##### Method Signature

```typescript
getTags(): string[];
```

Returns all the registered tags.

#### .getWithAll()

##### Method Signature

```typescript
getWithAll(...tags: string[]): THREE.Object3D[];
```

Returns a list of objects which have all of the given tags.

#### .getWithAny()

##### Method Signature

```typescript
getWithAny(...tags: string[]): THREE.Object3D[];
```

Returns a list of objects which have any of the given tags.

#### .hasAny()

##### Method Signature

```typescript
hasAny(object: THREE.Object3D, ...tags: string[]): boolean;
```

Checks if an object has any of the given tags.

#### .hasAll()

##### Method Signature

```typescript
hasAll(object: THREE.Object3D, ...tags: string[]): boolean;
```

Checks if an object has all of the given tags.

#### .hasNone()

##### Method Signature

```typescript
hasNone(object: THREE.Object3D, ...tags: string[]): boolean;
```

Checks if an object has none of the given tags.

#### .isMissingAll()

##### Method Signature

```typescript
isMissingAll(object: THREE.Object3D, ...tags: string[]): boolean;
```

Checks if an object is missing all of the given tags.

#### .get()

##### Method Signature

```typescript
get(object: THREE.Object3D): string[];
```

Returns all tags of a given object.

#### .set()

##### Method Signature

```typescript
set(object: THREE.Object3D, ...tags: string[]): void;
```

Sets all the given tags to an object. If a tag does not exist yet, it'll be created and registered.

#### .remove()

##### Method Signature

```typescript
remove(object: THREE.Object3D, ...tags: string[]): void;
```

Removes the given tags from an object.

#### .create()

##### Method Signature

```typescript
create(...tags: string[]): void;
```

Creates the given tags. If a tag is already present it will be omitted.
