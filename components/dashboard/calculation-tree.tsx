"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, RefreshCw, User, MessageSquare, Heart, ChevronRight, ChevronDown, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Node {
  id: string
  name: string
  content: string
  timestamp: string
  value?: number
  operation?: string
  userNumber?: number
  resultNumber?: number
  children?: Node[]
  isOpen?: boolean
  likes?: number
}

interface ReplyForm {
  name: string
  content: string
  operation: string
  userNumber: number
}

export function CalculationTree() {
  const [tree, setTree] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyForm, setReplyForm] = useState<ReplyForm>({
    name: "",
    content: "",
    operation: "+",
    userNumber: 0
  })
  
  const [newDiscussion, setNewDiscussion] = useState({
    name: "",
    content: "",
    startingNumber: 0
  })
  
  const supabase = createClient()

  const operations = [
    { value: "+", symbol: "+", description: "Add" },
    { value: "-", symbol: "−", description: "Subtract" },
    { value: "*", symbol: "×", description: "Multiply" },
    { value: "/", symbol: "÷", description: "Divide" },
    { value: "^", symbol: "^", description: "Power" },
    { value: "mod", symbol: "mod", description: "Modulo" }
  ]

  // Fetch initial data
  useEffect(() => {
    fetchTreeData()
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel("calculations-changes")
      .on("postgres_changes", 
        { event: "*", schema: "public", table: "calculations" }, 
        (payload) => {
          console.log("Real-time update received:", payload)
          if (payload.new && (payload.new as any).formula) {
            setTree((payload.new as any).formula)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchTreeData = async () => {
  try {
    // First try to load from database
    const { data, error } = await supabase
      .from("calculations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (!error && data && data.formula) {
      console.log("Loaded data from DB:", data.formula)
      setTree(data.formula)
    } else {
      // Try localStorage as fallback
      const localData = await loadFromLocalStorage()
      if (localData) {
        console.log("Loaded data from localStorage:", localData)
        setTree(localData)
      } else {
        // Default data
        const defaultTree: Node[] = [
          {
            id: "1",
            name: "Alex",
            content: "Let's discuss numbers! Starting with 42.",
            timestamp: new Date().toLocaleString(),
            value: 42,
            resultNumber: 42,
            isOpen: true,
            children: []
          }
        ]
        setTree(defaultTree)
        // Save default
        await saveToLocalStorage(defaultTree)
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error)
    // Try localStorage
    const localData = await loadFromLocalStorage()
    if (localData) {
      setTree(localData)
    } else {
      const defaultTree: Node[] = [
        {
          id: "1",
          name: "Alex",
          content: "Welcome to Number Communication!",
          timestamp: new Date().toLocaleString(),
          value: 10,
          resultNumber: 10,
          isOpen: true,
          children: []
        }
      ]
      setTree(defaultTree)
    }
  } finally {
    setLoading(false)
  }
}
const testDatabaseConnection = async () => {
  try {
    toast.info("Testing database connection...")
    
    // Test 1: Check if we can query the table
    const { data, error, count } = await supabase
      .from("calculations")
      .select("*", { count: 'exact', head: true })
    
    console.log("Table query test:", { data, error, count })
    
    if (error) {
      toast.error(`Query error: ${error.message}`)
      return false
    }
    
    // Test 2: Try to insert a test record
    const testData = {
      user_id: "test-user",
      name: "Test Connection",
      description: "Testing database connection",
      formula: [{ id: "test", name: "Test", content: "Test" }],
      result: 1,
      is_public: false
    }
    
    const { error: insertError } = await supabase
      .from("calculations")
      .insert(testData)
    
    if (insertError) {
      console.log("Insert test (expected if RLS blocks):", insertError)
      toast.warning("RLS might be blocking writes")
    } else {
      // Clean up test data
      await supabase
        .from("calculations")
        .delete()
        .eq("name", "Test Connection")
      toast.success("Database connection successful!")
    }
    
    // Test 3: Check RLS policies
    const { data: policies } = await supabase.rpc('get_policies', { 
      table_name: 'calculations' 
    }).catch(() => ({ data: null }))
    
    console.log("RLS policies:", policies)
    
    return true
  } catch (error: any) {
    console.error("Connection test failed:", error)
    toast.error(`Connection failed: ${error.message}`)
    return false
  }
}

  const calculateResult = (parentNumber: number, operation: string, userNumber: number): number => {
    switch (operation) {
      case "+": return parentNumber + userNumber
      case "-": return parentNumber - userNumber
      case "*": return parentNumber * userNumber
      case "/": return userNumber !== 0 ? parentNumber / userNumber : NaN
      case "^": return Math.pow(parentNumber, userNumber)
      case "mod": return userNumber !== 0 ? parentNumber % userNumber : NaN
      default: return parentNumber
    }
  }

  const addNode = (tree: Node[], parentId: string, newNode: Node): Node[] => {
    return tree.map(node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newNode],
          isOpen: true
        }
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: addNode(node.children, parentId, newNode)
        }
      }
      return node
    })
  }

  const findParentResult = (tree: Node[], nodeId: string): number => {
    for (const node of tree) {
      if (node.id === nodeId) {
        return node.resultNumber || node.value || 0
      }
      if (node.children) {
        const childResult = findParentResult(node.children, nodeId)
        if (childResult !== undefined) return childResult
      }
    }
    return 0
  }

  const handleReply = async () => {
    if (!replyingTo || !replyForm.name.trim() || !replyForm.content.trim()) {
      toast.error("Please fill all fields")
      return
    }

    try {
      const parentResult = findParentResult(tree, replyingTo)
      const resultNumber = calculateResult(parentResult, replyForm.operation, replyForm.userNumber)

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: replyForm.name,
        content: replyForm.content,
        timestamp: new Date().toLocaleString(),
        operation: replyForm.operation,
        userNumber: replyForm.userNumber,
        resultNumber: resultNumber,
        isOpen: true,
        children: []
      }

      const updatedTree = addNode(tree, replyingTo, newNode)
      setTree(updatedTree)
      
      // Save to database
      await saveToDatabase(updatedTree)
      
      toast.success("Reply added successfully!")
      
      // Reset form
      setReplyForm({
        name: "",
        content: "",
        operation: "+",
        userNumber: 0
      })
      setReplyingTo(null)
      
    } catch (error) {
      console.error("Error adding reply:", error)
      toast.error("Failed to add reply")
    }
  }

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.name.trim() || !newDiscussion.content.trim()) {
      toast.error("Please fill all fields")
      return
    }

    try {
      const newNode: Node = {
        id: `discussion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newDiscussion.name,
        content: newDiscussion.content,
        timestamp: new Date().toLocaleString(),
        value: newDiscussion.startingNumber,
        resultNumber: newDiscussion.startingNumber,
        isOpen: true,
        children: [],
        likes: 0
      }

      const updatedTree = [newNode, ...tree]
      setTree(updatedTree)
      
      // Save to database
      await saveToDatabase(updatedTree)
      
      toast.success("Discussion created successfully!")
      
      // Reset form
      setNewDiscussion({
        name: "",
        content: "",
        startingNumber: 0
      })
      
    } catch (error) {
      console.error("Error creating discussion:", error)
      toast.error("Failed to create discussion")
    }
  }
const saveToDatabase = async (treeData: Node[]) => {
  setSaving(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Create calculation data
    const calculationData = {
      user_id: user?.id || "anonymous",
      name: "Number Communication Tree",
      description: "Social network discussion tree",
      formula: treeData,
      result: treeData.length,
      updated_at: new Date().toISOString(),
      created_at: user?.id ? undefined : new Date().toISOString() // Only set for new records
    }

    console.log("Attempting to save to database:", calculationData)

    // First, try to get existing record for this user
    const { data: existingData, error: fetchError } = user?.id 
      ? await supabase
          .from("calculations")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", "Number Communication Tree")
          .maybeSingle()
      : { data: null, error: null }

    if (fetchError) {
      console.error("Error fetching existing data:", fetchError)
      throw fetchError
    }

    let result
    if (existingData?.id) {
      // Update existing record
      result = await supabase
        .from("calculations")
        .update({
          formula: treeData,
          result: treeData.length,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingData.id)
    } else {
      // Insert new record
      result = await supabase
        .from("calculations")
        .insert(calculationData)
    }

    const { data, error, status, statusText } = result

    if (error) {
      console.error("Full Supabase error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status,
        statusText
      })
      throw error
    }

    console.log("Saved successfully to database:", { data, status, statusText })
    toast.success("Saved successfully!")
    
  } catch (error: any) {
    console.error("Error saving to database:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      details: error?.details
    })
    
    // Try alternative save method if main one fails
    try {
      await saveToLocalStorage(treeData)
      toast.warning("Saved locally (database unavailable)")
    } catch (localError) {
      toast.error("Failed to save")
    }
  } finally {
    setSaving(false)
  }
}

// Fallback function to save to localStorage
const saveToLocalStorage = async (treeData: Node[]) => {
  try {
    localStorage.setItem('number-communication-tree', JSON.stringify(treeData))
    console.log("Saved to localStorage")
    return true
  } catch (error) {
    console.error("Error saving to localStorage:", error)
    throw error
  }
}

// Load from localStorage on initial fetch
const loadFromLocalStorage = async () => {
  try {
    const savedData = localStorage.getItem('number-communication-tree')
    if (savedData) {
      return JSON.parse(savedData)
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error)
  }
  return null
}
  const toggleNode = (id: string) => {
    const toggle = (nodes: Node[]): Node[] =>
      nodes.map(node => ({
        ...node,
        isOpen: node.id === id ? !node.isOpen : node.isOpen,
        children: node.children ? toggle(node.children) : node.children
      }))
    setTree(toggle(tree))
  }

  const renderNode = (node: Node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0
    
    return (
      <div key={node.id} className="mb-2">
        <div className={cn(
          "flex border border-gray-300 bg-white rounded",
          level > 0 && "ml-8"
        )}>
          {/* User Info */}
          <div className="w-32 border-r border-gray-300 p-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-2">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <span className="font-semibold text-sm">{node.name}</span>
            {node.value !== undefined && (
              <span className="text-xs text-purple-600 mt-1">
                Start: {node.value}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm text-gray-500">{node.timestamp}</span>
              {hasChildren && (
                <button
                  onClick={() => toggleNode(node.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {node.isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Mathematical Operation */}
            {node.operation && (
              <div className="mb-3 p-3 bg-gray-50 rounded border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold">Operation:</span>
                  <code className="px-2 py-1 bg-white border rounded">
                    {node.operation} {node.userNumber}
                  </code>
                  <span className="font-bold">=</span>
                  <span className="text-lg font-bold text-green-600">
                    {node.resultNumber?.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Message Content */}
            <p className="mb-4">{node.content}</p>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setReplyingTo(node.id)
                  setReplyForm(prev => ({ ...prev, name: "" }))
                }}
                className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                <MessageSquare className="h-4 w-4" />
                Reply
              </button>
              
              <button className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                <Heart className="h-4 w-4" />
                <span>{node.likes || 0}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Reply Form */}
        {replyingTo === node.id && (
          <div className={cn(
            "ml-8 mt-3 p-4 border border-blue-200 bg-blue-50 rounded",
            level > 0 && "ml-16"
          )}>
            <h4 className="font-semibold mb-3 text-blue-700">Reply to {node.name}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <Input
                placeholder="Your Name"
                value={replyForm.name}
                onChange={(e) => setReplyForm({ ...replyForm, name: e.target.value })}
              />
              <Select
                value={replyForm.operation}
                onValueChange={(value) => setReplyForm({ ...replyForm, operation: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Operation" />
                </SelectTrigger>
                <SelectContent>
                  {operations.map(op => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.symbol} ({op.description})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Number"
                value={replyForm.userNumber}
                onChange={(e) => setReplyForm({ ...replyForm, userNumber: parseFloat(e.target.value) || 0 })}
              />
              <div className="text-sm text-gray-600 flex items-center">
                Result: {calculateResult(
                  node.resultNumber || node.value || 0,
                  replyForm.operation,
                  replyForm.userNumber
                ).toFixed(2)}
              </div>
            </div>
            <Textarea
              placeholder="Your message..."
              value={replyForm.content}
              onChange={(e) => setReplyForm({ ...replyForm, content: e.target.value })}
              className="mb-3"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleReply}
                disabled={!replyForm.name.trim() || !replyForm.content.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Post Reply
              </Button>
              <Button
                variant="outline"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Child Nodes */}
        {hasChildren && node.isOpen && (
          <div className="mt-3">
            {node.children?.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Number Communication Network
          </h1>
          <p className="text-gray-600 mb-6">
            A social network where conversations are built through mathematical operations on numbers.
          </p>

          {/* Create Discussion Form */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3">Start New Discussion</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <Input
                placeholder="Your Name"
                value={newDiscussion.name}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, name: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Starting Number"
                value={newDiscussion.startingNumber}
                onChange={(e) => setNewDiscussion({ 
                  ...newDiscussion, 
                  startingNumber: parseFloat(e.target.value) || 0 
                })}
              />
              <Input
                placeholder="Discussion Topic"
                value={newDiscussion.content}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
              />
            </div>
            <Button
              onClick={handleCreateDiscussion}
              disabled={!newDiscussion.name.trim() || !newDiscussion.content.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start Discussion
            </Button>
          </div>

          {/* Stats and Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tree.length}</div>
                <div className="text-sm text-gray-500">Discussions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tree.reduce((acc, node) => {
                    const countNodes = (n: Node): number => {
                      return 1 + (n.children?.reduce((childAcc, child) => childAcc + countNodes(child), 0) || 0)
                    }
                    return acc + countNodes(node)
                  }, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Messages</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchTreeData}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={() => saveToDatabase(tree)}
                disabled={saving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save All"}
              </Button>
            </div>
          </div>
        </div>

        {/* Conversations Tree */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Conversations</h2>
          
          {tree.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No discussions yet. Start the first one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tree.map(node => renderNode(node))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">How to use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
            <li>Start a discussion with any number</li>
            <li>Reply to any message with a mathematical operation</li>
            <li>Each reply creates a new number in the conversation chain</li>
            <li>Click "Save All" to save the entire conversation tree</li>
            <li>All data is stored in the database and persists between sessions</li>
          </ol>
        </div>
      </div>
    </div>
  )
}