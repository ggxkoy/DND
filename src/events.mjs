const HEARTBEAT_INTERVAL_MS = 25000;

const roomSubscribers = new Map(); // roomId -> Set<res>
const lobbySubscribers = new Set();

export function subscribeRoom(roomId, req, res) {
  let set = roomSubscribers.get(roomId);
  if (!set) {
    set = new Set();
    roomSubscribers.set(roomId, set);
  }
  attach(set, req, res);
  if (!set.size) {
    roomSubscribers.delete(roomId);
  }
}

export function subscribeLobby(req, res) {
  attach(lobbySubscribers, req, res);
}

export function broadcastRoom(roomId, payload) {
  const set = roomSubscribers.get(roomId);
  if (!set?.size) {
    return;
  }
  emit(set, "room", payload);
  if (!set.size) {
    roomSubscribers.delete(roomId);
  }
}

export function broadcastLobby() {
  emit(lobbySubscribers, "lobby", { at: new Date().toISOString() });
}

function attach(set, req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write("retry: 3000\n\n");

  // 注释行心跳,防止反向代理掐断空闲连接
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      cleanup();
    }
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    set.delete(res);
  };

  set.add(res);
  res.on("close", cleanup);
}

function emit(set, eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of [...set]) {
    try {
      res.write(frame);
    } catch {
      set.delete(res);
    }
  }
}
