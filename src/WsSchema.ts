import { WebSocket } from "ws";
import { ZodType, z, ZodError } from "zod";

/**
 * Given the generic type Record<string, ZodType> allow for construction of functions to emit type-safe data for given events.
 *
 * The keys within the provided Record type act as the 'eventIDs' in the emitted event.
 *
 * The associated zod types provided act as the type of the data payload for the given eventID
 */
export class WsSchema<T extends Record<string, ZodType>> {
  /**
   *
   * @param validators an object with key value pairs representing the event name (key) and the associated payload structure (value)
   */
  constructor(
    private validators: T,
    private errors: Partial<{
      incomingMessage: Partial<{
        invalidStructure: () => any;
        unrecognisedEvent: (unrecognisedEvent: string) => any;
        invalidEventPayload: (event: keyof T) => any;
      }>;
    }> = {}
  ) {}

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
      data: (data: Parameters<typeof this.sendData<E>>[1]) => {
        return this.sendData(event, data);
      },
    };
  }

  private sendData<E extends Extract<keyof T, string>>(
    event: E,
    data: z.infer<T[E]>
  ) {
    return {
      /**
       *
       * @param to who to send the data to
       * @returns
       */
      to: (to: Parameters<typeof this.sendDataTo<E>>[2]) => {
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
   * Create a 'receiver' callback to be used to handle incoming message event strings.
   *
   * Handles message structure & payload validation, calling the appropriate event callback only if validation is successful.
   *
   * @param on specify callbacks that should run when the event (key) is received
   * @returns
   */
  public receiver(on: BuildReceiver<T>) {
    return (incomingMessageString: string) => {
      try {
        const json = JSON.parse(incomingMessageString);

        // If message content is in invalid structure
        if (!json.event || !json.data || typeof json.event !== "string") {
          this.errors.incomingMessage?.invalidStructure?.();
          return false;
        }

        // If incoming event is not recognised by those defined by schema
        if (!Object.keys(this.validators).includes(json.event)) {
          this.errors.incomingMessage?.unrecognisedEvent?.(json.event);
          return false;
        }

        // Specified event is defined within schema but not provided a callback to run within receiver
        if (!Object.keys(on).includes(json.event)) {
          return true;
        }

        // if payload of incoming message is not valid for event specified
        try {
          this.validators[json.event].parse(json.data);
        } catch (e) {
          if (e instanceof ZodError)
            this.errors.incomingMessage?.invalidEventPayload?.(json.event);
          return false;
        }

        // call relevant event callback with data
        on[json.event]?.(json.data);
        return true;
      } catch (e) {
        if (e instanceof SyntaxError)
          this.errors.incomingMessage?.invalidStructure?.();
        return false;
      }
    };
  }

  /**
   *
   * @param eventID the eventID to emit with
   * @param data the data to emit
   * @param to sockets to emit the event to
   */
  private static emit<D extends any>( //TODO: make this type only serializable types
    eventID: string,
    data: D,
    to: WebSocket | WebSocket[]
  ) {
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
}

type BuildReceiver<T extends Record<string, any>> = Partial<{
  [K in keyof T]: (arg: z.infer<T[K]>) => any;
}>;

export type ExtractWSMessageTemplateGeneric<T> = T extends WsSchema<infer E>
  ? E
  : never;

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
