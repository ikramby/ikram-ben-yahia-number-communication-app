import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Logout error:", error.message)
  }

  const url = new URL(request.url)
  return NextResponse.redirect(new URL("/login", url.origin), {
    status: 301,
  })
}