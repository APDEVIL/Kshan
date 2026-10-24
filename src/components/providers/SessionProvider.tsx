"use client";

import { useQuery } from "convex/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api, type Id, type SessionRef } from "@/lib/convex";
import { isRoleKey, type RoleKey } from "@/lib/roles";

const SESSION_KEY = "kshan-session";
const PLAYAS_KEY = "kshan-playas";

function readStore(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null; // storage can be blocked
	}
}

function writeStore(key: string, value: string | null): void {
	try {
		if (value === null) window.localStorage.removeItem(key);
		else window.localStorage.setItem(key, value);
	} catch {
		// ignore, the app works without storage
	}
}

interface SessionContextValue {
	/** The session every screen follows. null when there is none yet. */
	sessionId: Id<"sessions"> | null;
	setSessionId: (id: Id<"sessions"> | null) => void;
	/** The role the visitor is playing in a guided walkthrough, or null for watch-only. */
	playAs: RoleKey | null;
	setPlayAs: (role: RoleKey | null) => void;
	sessions: SessionRef[] | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Keeps one "current session" for the whole app. It is stored in localStorage, so a second
 * browser window (for example the driver phone next to the control room) follows the same session.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
	const [pinned, setPinned] = useState<string | null>(null);
	const [playAs, setPlayAsState] = useState<RoleKey | null>(null);
	const sessions = useQuery(api.views.listSessionIds, { limit: 20 });

	useEffect(() => {
		const load = () => {
			setPinned(readStore(SESSION_KEY));
			const stored = readStore(PLAYAS_KEY);
			setPlayAsState(stored && isRoleKey(stored) ? stored : null);
		};
		load();
		const onStorage = (e: StorageEvent) => {
			if (e.key === null || e.key === SESSION_KEY || e.key === PLAYAS_KEY)
				load();
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const setSessionId = useCallback((id: Id<"sessions"> | null) => {
		setPinned(id);
		writeStore(SESSION_KEY, id);
	}, []);

	const setPlayAs = useCallback((role: RoleKey | null) => {
		setPlayAsState(role);
		writeStore(PLAYAS_KEY, role);
	}, []);

	// A pinned id wins while it still exists. After a reset, fall back to the latest open session.
	const sessionId = useMemo<Id<"sessions"> | null>(() => {
		if (sessions === undefined) return pinned as Id<"sessions"> | null;
		const match = pinned ? sessions.find((s) => s._id === pinned) : undefined;
		if (match) return match._id;
		const open = sessions.find((s) => s.status !== "closed");
		return (open ?? sessions[0])?._id ?? null;
	}, [pinned, sessions]);

	const value = useMemo(
		() => ({ sessionId, setSessionId, playAs, setPlayAs, sessions }),
		[sessionId, setSessionId, playAs, setPlayAs, sessions],
	);
	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSessionContext(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx)
		throw new Error("useSessionContext must be used inside <SessionProvider>.");
	return ctx;
}
