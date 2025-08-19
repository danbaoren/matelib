
// Assets/matelib/modules/UI/Effect.ts

import { Component } from "./Component";

let currentComponent: Component | null = null;

export function setCurrentComponent(component: Component | null) {
    currentComponent = component;
}

export function onMount(callback: () => void) {
    if (currentComponent) {
        currentComponent._addMountCallback(callback);
    }
}

export function onDestroy(callback: () => void) {
    if (currentComponent) {
        currentComponent._addDestroyCallback(callback);
    }
}
