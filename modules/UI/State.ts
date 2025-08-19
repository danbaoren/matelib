// Assets/matelib/modules/UI/State.ts

type Subscriber = () => void;

export interface State<T> {
    value: T;
    subscribe(subscriber: Subscriber): () => void;
}

export function createState<T>(initialValue: T): State<T> {
    let value = initialValue;
    const subscribers = new Set<Subscriber>();

    const state = {
        get value() {
            // In a more advanced implementation, this is where you'd track dependencies.
            return value;
        },
        set value(newValue: T) {
            if (value !== newValue) {
                value = newValue;
                subscribers.forEach(sub => sub());
            }
        },
        subscribe(subscriber: Subscriber): () => void {
            subscribers.add(subscriber);
            return () => subscribers.delete(subscriber);
        }
    };

    return state;
}