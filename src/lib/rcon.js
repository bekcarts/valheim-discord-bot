import net from "node:net";

const RCON_HOST = process.env.RCON_HOST || "127.0.0.1";
const RCON_PORT = parseInt(process.env.RCON_PORT || "2458", 10);
const RCON_PASSWORD = process.env.RCON_PASSWORD || "";

const PACKET_AUTH = 3;
const PACKET_EXEC = 2;

function buildPacket(id, type, body) {
  const bodyBuf = Buffer.from(body, "utf8");
  const payload = Buffer.concat([
    Buffer.alloc(8),
    bodyBuf,
    Buffer.from([0, 0]),
  ]);
  payload.writeInt32LE(id, 0);
  payload.writeInt32LE(type, 4);
  const lengthPrefix = Buffer.alloc(4);
  lengthPrefix.writeInt32LE(payload.length, 0);
  return Buffer.concat([lengthPrefix, payload]);
}

function readPacket(buffer) {
  if (buffer.length < 4) return null;
  const length = buffer.readInt32LE(0);
  if (buffer.length < 4 + length) return null;
  const id = buffer.readInt32LE(4);
  const type = buffer.readInt32LE(8);
  const body = buffer.slice(12, 4 + length - 2).toString("utf8");
  return { id, type, body, consumed: 4 + length };
}

/** Sends a single RCON command to the game server (e.g. "broadcast center Hello"). */
export function sendRconCommand(command) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: RCON_HOST, port: RCON_PORT });
    let buffer = Buffer.alloc(0);
    let authenticated = false;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("RCON connection timed out"));
    }, 5000);

    socket.on("connect", () => {
      socket.write(buildPacket(1, PACKET_AUTH, RCON_PASSWORD));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const packet = readPacket(buffer);
      if (!packet) return;
      buffer = buffer.slice(packet.consumed);

      if (!authenticated) {
        if (packet.id === -1) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error("RCON authentication failed (wrong password)"));
          return;
        }
        authenticated = true;
        socket.write(buildPacket(2, PACKET_EXEC, command));
        return;
      }

      clearTimeout(timeout);
      socket.end();
      resolve(packet.body);
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function isRconConfigured() {
  return Boolean(RCON_PASSWORD);
}
