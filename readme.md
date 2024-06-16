# WS-Schema

Create type-safe schemas for ws message events.

Easily construct and handle ws message content, with type-safety and inferrance for payloads specific to each defined event.

## Usage

### Defining a schema

Define a schema using the `WsSchema` class. Here, the keys represent the name of each event you which to define in your schema. The value pairs then represent the structure of the payload to be associated to that event.

```typescript
const wsSchema = new WsSchema({
  heartbeat: z.object({}),
  message: z.string(),
  user_online: z.object({
    user: z.object({
      name: z.string(),
      id: z.number(),
      bio: z.string().optional(),
    }),
    isfriend: z.boolean(),
  }),
});
```

### Constructing / sending an event

Using the schema you have now defined, you may now easily construct and send message payloads with full type inferrence and safety.

```typescript
// Define the payload for one of the events defined in our schema
const hello = wsSchema.send("message").data("hello world");

// Select how we want to use this constructed object

// JSON stringified
hello.stringify();

// js object
hello.object();

// Send directly to some websocket(s)
hello.to(someWebsocket, anotherWebsocket).emit();
```

_or_

```typescript
// Or even just construct and send an event in one statement
wsSchema.send("message").data("this library is awesome").to(someWebsocket).emit();
```

### Constructing a receiver callback

Of course if you are sending these events, you must have some logic on the other side that will handle these events in some way when they are received.

This is easily done using the `receiver` method, in which we can _optionally_ define callbacks for each event, the payload attached to the given event will be given as the argument for the callback.

Once again, the payloads and events come with full type inferrence & safety.

Run-time validation occurs on incoming payloads for each event, to ensure the payload is of a valid structure for the event as defined within the schema. The callback will only be called if this validation is successful.

```typescript
// Define our callbacks
const onIncomingMessage = wsSchema.receiver({
  message: (message) => {
    console.log("received a new message!", message);
  },
  user_online: ({ isfriend, user }) => {
    if (isfriend) console.log("friend online!", user.name);
  },
});
```

```typescript
// Assuming ws is our websocket

// Define a callback for a ws message event
// (this is not the same as our custom defined 'message' event in our schema, but instead a standardised event for websockets)

ws.on("message", (incomingMessage) => {
  // pass the string representation of our incoming message to the callback we created with our schema
  onIncomingMessage(incomingMessage.data);
});
```
