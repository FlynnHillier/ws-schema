import { WebSocket } from "ws";
import { ZodType, z } from "zod";

/**
 * Given the generic type Record<string, ZodType> allow for construction of functions to emit type-safe data for given events.
 *
 * The keys within the provided Record type act as the 'eventIDs' in the emitted event.
 *
 * The associated zod types provided act as the type of the data payload for the given eventID
 */
export class WsSchema<T extends Record<string, ZodType>> {
  private validators: T;

  /**
   *
   * @param validators an object with key value pairs representing the event name (key) and the associated payload structure (value)
   */
  constructor(validators: T) {
    this.validators = validators;
  }

  /**
   *
   * @param event a given eventID
   */
  public send<E extends Extract<keyof T, string>>(event: E) {
    return {
      /**
       *
       * @param data the data to send
       */
      data: (data: z.infer<T[E]>) => {
        return this.sendData(event, data);
      },
    };
  }

  private sendData<E extends Extract<keyof T, string>>(event: E, data: z.infer<T[E]>) {
    return {
      /**
       *
       * @param to who to send the data to
       * @returns
       */
      to: (to: WebSocket | WebSocket[]) => {
        return this.sendDataTo(event, data, to);
      },
      /**
       *
       * @returns an object represesentation of the constructed ws event
       */
      object: () => ({
        event: event,
        data: data,
      }),
      /**
       *
       * @returns a stringified version of the object representation of the constructed ws event
       */
      stringify: () => {
        return JSON.stringify({ event: event, data: data });
      },
    };
  }

  private sendDataTo<E extends Extract<keyof T, string>>(
    event: E,
    data: z.infer<T[E]>,
    to: WebSocket | WebSocket[]
  ) {
    return {
      /**
       * Broadcast the constructed message
       */
      emit: () => {
        WsSchema.emit(event, data, to);
      },
    };
  }

  /**
   *
   * @param eventID the eventID to emit with
   * @param data the data to emit
   * @param to sockets to emit the event to
   */
  private static emit<D extends any>(eventID: string, data: D, to: WebSocket | WebSocket[]) {
    //TODO: make this type only serializable types
    const sockets = new Set<WebSocket>(Array.isArray(to) ? to : [to]);

    sockets.forEach((socket) =>
      socket.send(
        JSON.stringify({
          event: eventID,
          data: data,
        })
      )
    );
  }

  public receiver(on: BuildReceiver<T>) {
    return (incomingMessageString: string) => {
      try {
        const json = JSON.parse(incomingMessageString);

        if (
          !json.event ||
          !json.data ||
          typeof json.event !== "string" ||
          !Object.keys(on).includes(json.event)
        )
          return;

        this.validators[json.event]!.parse(json.data);

        on[json.event]?.(json.data);
      } catch (e) {
        if (typeof window !== "undefined") {
          console.error("received malform event payload on ws event", incomingMessageString);
        }
        return; //TODO: change this
      }
    };
  }
}

type BuildReceiver<T extends Record<string, any>> = Partial<{
  [K in keyof T]: (arg: z.infer<T[K]>) => any;
}>;

export type ExtractWSMessageTemplateGeneric<T> = T extends WsSchema<infer E> ? E : never;

/**
 * Extract the data type for a given event from a WSMessageTemplate class
 *
 * T - the template with the desired specified message event typings
 *
 * E - the event we want to extract the type for
 */
export type WSMessageData<
  T extends WsSchema<any>,
  E extends keyof ExtractWSMessageTemplateGeneric<T>
> = ExtractWSMessageTemplateGeneric<T>[E];
