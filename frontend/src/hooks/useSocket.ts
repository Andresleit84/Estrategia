"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3021";
    socket = io(`${url}/notifications`, {
      withCredentials: true,
      autoConnect: false,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function useSocket() {
  const qc = useQueryClient();
  const connectedRef = useRef(false);

  const connect = useCallback(() => {
    const s = getSocket();
    if (connectedRef.current) return;
    s.connect();
    connectedRef.current = true;

    s.off("checkin:created").on("checkin:created", () => {
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["objectives"] });
      qc.invalidateQueries({ queryKey: ["key-results"] });
    });

    s.off("notification:new").on("notification:new", () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [qc]);

  const disconnect = useCallback(() => {
    socket?.off("checkin:created").off("notification:new").disconnect();
    socket = null;
    connectedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      socket?.off("checkin:created").off("notification:new");
    };
  }, []);

  return { connect, disconnect, socket: getSocket() };
}
