"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, RefreshCw, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Node {
  id: string
  name: string
  content?: string
  timestamp?: string
  value?: number
  avatar?: string
  children?: Node[]
  isOpen?: boolean
}

export function CalculationTree() {
  const [tree, setTree] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setTree(data.formula as Node[])
      } else {
        setTree([
          {
            id: "1",
            name: "Alex",
            timestamp: "10.07.2017 в 09:00",
            avatar: "/images/image.png",
            content:
              "Fusce nec accumsan eros. Aenean ac orci a magna vestibulum posuere quis nec nisi. Maecenas rutrum vehicula Fusce nec accumsan eros. Aenean ac orci a magna vestibulum posuere quis nec nisi. Donec vel vulputate nibh. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.",
            isOpen: true,
            children: [
              {
                id: "2",
                name: "George",
                timestamp: "10.07.2017 в 11:06",
                content: "Text2",
                isOpen: true,
                children: [
                  {
                    id: "3",
                    name: "Masha",
                    timestamp: "11.07.2017 в 05:20",
                    content: "Text3",
                    isOpen: true,
                    children: [
                      {
                        id: "4",
                        name: "Syed",
                        timestamp: "12.07.2017 в 06:15",
                        content: "Text5",
                      },
                    ],
                  },
                ],
              },
              {
                id: "5",
                name: "Julia",
                timestamp: "11.07.2017 в 16:28",
                content: "Text4",
              },
            ],
          },
        ])
      }
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "calculations" }, (payload) => {
        if (payload.new) {
          setTree((payload.new as any).formula as Node[])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const toggleNode = (id: string) => {
    setTree((prev) => {
      const update = (nodes: Node[]): Node[] =>
        nodes.map((node) => {
          if (node.id === id) return { ...node, isOpen: !node.isOpen }
          if (node.children) return { ...node, children: update(node.children) }
          return node
        })
      return update(prev)
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("calculations").upsert({
      user_id: user.id,
      name: "Main Calculation",
      formula: tree,
    })
    setSaving(false)
  }

  const renderNode = (node: Node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0
    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex border border-[#ccc] bg-white mb-[-1px]", // Stack borders with negative margin
            level > 0 && "ml-[40px]", // Indentation per level
          )}
        >
          {/* User Sidebar */}
          <div className="w-[110px] min-w-[110px] border-r border-[#ccc] p-3 flex flex-col items-center gap-2">
            <div className="w-[80px] h-[80px] border border-[#ccc] flex items-center justify-center bg-[#f5f5f5] overflow-hidden">
              {node.name === "Alex" ? (
                <img src="/alex-profile-photo.png" alt="Alex" className="w-full h-full object-cover" />
              ) : (
                <div className="p-2 opacity-30">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>
            <span className="text-[14px] font-medium text-black">{node.name}</span>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-4 relative group">
            <div className="text-[12px] text-[#c07d32] mb-3">{node.timestamp}</div>
            <div className="text-[14px] leading-relaxed text-black mb-4">{node.content}</div>
            <button
              className="text-[14px] text-[#5e35b1] hover:underline focus:outline-none"
              onClick={() => hasChildren && toggleNode(node.id)}
            >
              Reply
            </button>

            {/* Action buttons for management */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border border-[#eee]">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive rounded-none border border-[#eee]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {hasChildren && node.isOpen && (
          <div className="mt-[-1px]">{node.children?.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading calculations...</div>

  return (
    <div className="bg-[#f0f0f0] p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#333]">Message Thread</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="rounded-none border-[#ccc]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="rounded-none bg-[#5e35b1] hover:bg-[#4527a0]"
            >
              {saving ? "Saving..." : "Save State"}
            </Button>
          </div>
        </div>
        <div className="bg-white">{tree.map((node) => renderNode(node))}</div>
      </div>
    </div>
  )
}