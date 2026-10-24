"use client";

import { GlowCard, type GlowCardProps } from "@/components/effects/GlowCard";

/** A GlowCard that leans toward the mouse. Used for the role cards on the home screen. */
export function TiltCard(props: Omit<GlowCardProps, "tilt">) {
	return <GlowCard tilt {...props} />;
}
