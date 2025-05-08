"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, SlidersHorizontal, X, Download, Tag, ArrowUpDown, Github, Linkedin, Coffee, ChevronDown } from "lucide-react"
import Image from "next/image"
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeToggle } from "@/components/theme-toggle"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface ModelResult {
  model_id: string
  tags: string[]
  downloads: number
  distance: number
  model_explanation_gemini?: string
}

interface GroupedModels {
  [key: string]: ModelResult[]
}

// --- Tag Filtering Configuration (mirrors backend) ---
const COMMON_EXCLUDED_TAGS = new Set(['transformers'])
const EXCLUDED_TAG_PREFIXES = ['arxiv:', 'base_model:', 'dataset:', 'diffusers:', 'license:']

function filterTagForDisplay(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false
  const lowerTag = tag.toLowerCase()
  return (
    tag.length > 3 &&
    !COMMON_EXCLUDED_TAGS.has(lowerTag) &&
    !EXCLUDED_TAG_PREFIXES.some((prefix) => lowerTag.startsWith(prefix))
  )
}
// --- End Tag Filtering Configuration ---

// Get base model name (before the first '-')
function getBaseModelName(modelId: string): string {
  const parts = modelId.split('/')
  const modelName = parts.length > 1 ? parts[1] : parts[0]
  const baseName = modelName.split('-')[0]
  return parts.length > 1 ? `${parts[0]}/${baseName}` : baseName
}

// Group models by their base name
function groupModelsByBaseName(models: ModelResult[]): GroupedModels {
  const grouped: GroupedModels = {}
  
  models.forEach(model => {
    const baseName = getBaseModelName(model.model_id)
    if (!grouped[baseName]) {
      grouped[baseName] = []
    }
    grouped[baseName].push(model)
  })
  
  return grouped
}

// Get stats for a group of models
function getGroupStats(models: ModelResult[]) {
  // Sort by relevance (lowest distance = highest relevance)
  const sortedByRelevance = [...models].sort((a, b) => a.distance - b.distance)
  const mostRelevantModel = sortedByRelevance[0]
  
  // Find min and max downloads
  const minDownloads = Math.min(...models.map(m => m.downloads))
  const maxDownloads = Math.max(...models.map(m => m.downloads))
  
  return {
    minDownloads,
    maxDownloads,
    bestRelevance: mostRelevantModel.distance,
    bestTags: mostRelevantModel.tags || []
  }
}

// Format model description to handle newlines and formatting
function formatModelDescription(description: string): string {
  if (!description) return '';
  
  // Convert **text** to proper markdown bold syntax
  description = description.replace(/\*\*(.*?)\*\*/g, '**$1**');
  
  // Convert basic HTML to markdown equivalents
  description = description.replace(/<b>(.*?)<\/b>/g, '**$1**');
  description = description.replace(/<i>(.*?)<\/i>/g, '*$1*');
  description = description.replace(/<u>(.*?)<\/u>/g, '_$1_');
  
  // Make sure there are proper line breaks
  description = description.replace(/\\n\\n/g, '\n\n');
  description = description.replace(/\\n/g, '\n');
  
  // Handle headings
  description = description.replace(/^# (.*?)$/gm, '# $1');
  description = description.replace(/^## (.*?)$/gm, '## $1');
  description = description.replace(/^### (.*?)$/gm, '### $1');
  
  return description;
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ModelResult[]>([])
  const [filteredResults, setFilteredResults] = useState<ModelResult[]>([])
  const [groupedResults, setGroupedResults] = useState<GroupedModels>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelResult | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [downloadRange, setDownloadRange] = useState<[number, number]>([0, 1000000])
  const [maxDownloads, setMaxDownloads] = useState(1000000)
  const [sortOption, setSortOption] = useState<string>("relevance")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [resultsLimit, setResultsLimit] = useState<number>(40)

  // Extract all unique tags from results
  useEffect(() => {
    if (results.length > 0) {
      const tags = new Set<string>()
      let maxDownload = 0

      results.forEach((result) => {
        if (result.tags) {
          result.tags.forEach((tag) => {
            if (filterTagForDisplay(tag)) {
              tags.add(tag)
            }
          })
        }
        if (result.downloads > maxDownload) {
          maxDownload = result.downloads
        }
      })

      setAvailableTags(Array.from(tags).sort())
      setMaxDownloads(maxDownload)
      setDownloadRange([0, maxDownload])
    }
  }, [results])

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...results]

    // Filter by tags if any selected
    if (selectedTags.length > 0) {
      filtered = filtered.filter((model) => model.tags && selectedTags.some((tag) => model.tags.includes(tag)))
    }

    // Filter by download range
    filtered = filtered.filter((model) => model.downloads >= downloadRange[0] && model.downloads <= downloadRange[1])

    // Apply sorting
    if (sortOption === "downloads-high") {
      filtered.sort((a, b) => b.downloads - a.downloads)
    } else if (sortOption === "downloads-low") {
      filtered.sort((a, b) => a.downloads - b.downloads)
    } else if (sortOption === "relevance") {
      filtered.sort((a, b) => a.distance - b.distance)
    }

    // Apply results limit
    filtered = filtered.slice(0, resultsLimit)
    console.log(`Applying results limit: ${resultsLimit}, filtered results: ${filtered.length}`)

    setFilteredResults(filtered)
    setGroupedResults(groupModelsByBaseName(filtered))
  }, [results, selectedTags, downloadRange, sortOption, resultsLimit])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setSelectedTags([])

    try {
      // Use environment variable for the backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error("Backend URL is not configured in environment variables.");
      }
      const response = await fetch(`${backendUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          top_k: Math.max(100, resultsLimit), // Request at least 100 results to have enough for filtering
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const clearFilters = () => {
    setSelectedTags([])
    setDownloadRange([0, maxDownloads])
    setSortOption("relevance")
    setResultsLimit(40)
  }

  const formatDownloadCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="Model Search Logo" 
              width={36} 
              height={36}
              className="rounded-full"
            />
            <h1 className="text-xl font-bold">Model Search</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 dark:from-primary dark:to-purple-400">
            Find the Perfect Model
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Search our extensive database of models using semantic similarity
          </p>

          <form onSubmit={handleSearch} className="relative">
            <Input
              type="text"
              placeholder="Describe what you're looking for..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-32 text-lg rounded-full shadow-lg focus:ring-2 focus:ring-primary"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full"
              size="lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Searching</span>
                </div>
              ) : (
                <span>Search</span>
              )}
            </Button>
          </form>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg shadow-sm">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">
                  {filteredResults.length} {filteredResults.length === 1 ? "Result" : "Results"}
                  {results.length > filteredResults.length && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (showing {filteredResults.length} of {results.length})
                    </span>
                  )}
                </h3>

                {selectedTags.length > 0 && (
                  <Badge variant="outline" className="gap-1 px-2 py-1">
                    <Tag className="h-3 w-3" />
                    {selectedTags.length}
                  </Badge>
                )}

                {(selectedTags.length > 0 ||
                  downloadRange[0] > 0 ||
                  downloadRange[1] < maxDownloads ||
                  sortOption !== "relevance") && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs">
                    <X className="h-3 w-3" />
                    Clear filters
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="downloads-high">Downloads (High to Low)</SelectItem>
                    <SelectItem value="downloads-low">Downloads (Low to High)</SelectItem>
                  </SelectContent>
                </Select>

                <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">Filters</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[300px] sm:w-[400px] overflow-y-auto flex flex-col">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>

                    <div className="py-6 space-y-6 flex-grow overflow-y-auto">
                      {/* Downloads Filter */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Downloads
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {formatDownloadCount(downloadRange[0])} - {formatDownloadCount(downloadRange[1])}
                          </span>
                        </div>
                        <Slider
                          defaultValue={[0, maxDownloads]}
                          max={maxDownloads}
                          step={Math.max(1, Math.floor(maxDownloads / 100))}
                          value={downloadRange}
                          onValueChange={(value) => setDownloadRange(value as [number, number])}
                          className="my-6"
                        />
                      </div>

                      {/* Results Limit Filter */}
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" />
                          Results Limit
                        </h4>
                        <Select 
                          value={resultsLimit.toString()} 
                          onValueChange={(val) => {
                            const newLimit = Number(val);
                            console.log(`Changing results limit from ${resultsLimit} to ${newLimit}`);
                            setResultsLimit(newLimit);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Max results to display" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 results</SelectItem>
                            <SelectItem value="20">20 results</SelectItem>
                            <SelectItem value="40">40 results</SelectItem>
                            <SelectItem value="60">60 results</SelectItem>
                            <SelectItem value="100">100 results</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Tags Filter */}
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Tags
                        </h4>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 border rounded-md p-3 border-gray-200 dark:border-gray-800">
                          {availableTags.map((tag) => (
                            <div key={tag} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tag-${tag}`}
                                checked={selectedTags.includes(tag)}
                                onCheckedChange={() => toggleTagFilter(tag)}
                              />
                              <Label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer flex-1 truncate">
                                {tag}
                              </Label>
                            </div>
                          ))}

                          {availableTags.length === 0 && (
                            <p className="text-sm text-muted-foreground">No tags available</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 mt-auto border-t border-gray-200 dark:border-gray-800 sticky bottom-0 bg-background">
                      <div className="flex justify-between items-center gap-4">
                        <Button variant="outline" onClick={clearFilters} className="flex-1">
                          Reset
                        </Button>
                        <Button onClick={() => setIsFiltersOpen(false)} className="flex-1">
                          Apply Filters
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 rounded-full"
                      onClick={() => toggleTagFilter(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="grid" className="mb-6">
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading ? (
                Array(8)
                  .fill(0)
                  .map((_, i) => (
                    <Card
                      key={i}
                      className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all"
                    >
                      <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                      </CardHeader>
                      <CardContent className="pb-2">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                      <CardFooter>
                        <div className="flex flex-wrap gap-1">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </CardFooter>
                    </Card>
                  ))
              ) : filteredResults.length > 0 ? (
                // Render grouped model results
                Object.entries(groupedResults).map(([baseName, models]) => (
                  <Card
                    key={baseName}
                    className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all"
                  >
                    {models.length > 1 ? (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={baseName} className="border-none">
                          <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex justify-between hover:no-underline">
                            <div className="flex-1">
                              <h3 className="font-medium text-lg truncate text-left" title={baseName}>
                                {baseName} <Badge variant="outline" className="ml-2">{models.length}</Badge>
                              </h3>
                              {(() => {
                                const stats = getGroupStats(models);
                                return (
                                  <>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <div className="flex items-center gap-1">
                                        <Download className="h-4 w-4" />
                                        <span>{formatDownloadCount(stats.minDownloads)} - {formatDownloadCount(stats.maxDownloads)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <ArrowUpDown className="h-4 w-4" />
                                        <span>Relevance: {(1 - stats.bestRelevance).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {stats.bestTags.filter(filterTagForDisplay).slice(0, 5).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {stats.bestTags.filter(filterTagForDisplay).length > 5 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{stats.bestTags.filter(filterTagForDisplay).length - 5}
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 px-6 pb-4">
                              {models.map(model => (
                                <div 
                                  key={model.model_id} 
                                  className="p-3 border border-gray-200 dark:border-gray-800 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
                                  onClick={() => setSelectedModel(model)}
                                >
                                  <h4 className="text-sm font-medium truncate" title={model.model_id}>
                                    {model.model_id}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Download className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-xs">{model.downloads.toLocaleString()}</p>
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground ml-2" />
                                    <p className="text-xs">Relevance: {(1 - model.distance).toFixed(2)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : (
                      // Single model case - just display as before
                      <>
                        <CardHeader className="pb-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer" onClick={() => setSelectedModel(models[0])}>
                          <CardTitle className="text-lg truncate" title={models[0].model_id}>
                            {models[0].model_id}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{models[0].downloads.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">Relevance: {(1 - models[0].distance).toFixed(2)}</p>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <div className="flex flex-wrap gap-1">
                            {models[0].tags && models[0].tags.length > 0 ? (
                              models[0].tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No tags</span>
                            )}
                            {models[0].tags && models[0].tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{models[0].tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </CardFooter>
                      </>
                    )}
                  </Card>
                ))
              ) : query.trim() !== "" ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">
                    No results found. Try a different search term or adjust your filters.
                  </p>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <div className="space-y-4">
              {loading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="overflow-hidden border border-gray-200 dark:border-gray-800">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2 mb-2" />
                          <div className="flex flex-wrap gap-1 mt-3">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-10 w-24 rounded-md" />
                        </div>
                      </div>
                    </Card>
                  ))
              ) : filteredResults.length > 0 ? (
                // Render grouped model results in list view
                Object.entries(groupedResults).map(([baseName, models]) => (
                  <Card
                    key={baseName}
                    className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all"
                  >
                    {models.length > 1 ? (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={baseName} className="border-none">
                          <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex justify-between hover:no-underline">
                            <div className="flex-1">
                              <h3 className="font-medium text-lg truncate text-left" title={baseName}>
                                {baseName} <Badge variant="outline" className="ml-2">{models.length}</Badge>
                              </h3>
                              {(() => {
                                const stats = getGroupStats(models);
                                return (
                                  <>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <div className="flex items-center gap-1">
                                        <Download className="h-4 w-4" />
                                        <span>{formatDownloadCount(stats.minDownloads)} - {formatDownloadCount(stats.maxDownloads)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <ArrowUpDown className="h-4 w-4" />
                                        <span>Relevance: {(1 - stats.bestRelevance).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {stats.bestTags.filter(filterTagForDisplay).slice(0, 5).map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {stats.bestTags.filter(filterTagForDisplay).length > 5 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{stats.bestTags.filter(filterTagForDisplay).length - 5}
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 px-4 pb-4">
                              {models.map(model => (
                                <div 
                                  key={model.model_id} 
                                  className="p-3 border border-gray-200 dark:border-gray-800 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 flex justify-between items-center"
                                  onClick={() => setSelectedModel(model)}
                                >
                                  <div className="flex-1">
                                    <h4 className="font-medium truncate" title={model.model_id}>
                                      {model.model_id}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <div className="flex items-center gap-1">
                                        <Download className="h-4 w-4" />
                                        <span>{model.downloads.toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <ArrowUpDown className="h-4 w-4" />
                                        <span>Relevance: {(1 - model.distance).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="outline" size="sm">
                                    View Details
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : (
                      // Single model case - just display as before
                      <div 
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                        onClick={() => setSelectedModel(models[0])}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-lg mb-1 truncate" title={models[0].model_id}>
                            {models[0].model_id}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Download className="h-4 w-4" />
                              <span>{models[0].downloads.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="h-4 w-4" />
                              <span>Relevance: {(1 - models[0].distance).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {models[0].tags && models[0].tags.length > 0 ? (
                              models[0].tags.slice(0, 5).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No tags</span>
                            )}
                            {models[0].tags && models[0].tags.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{models[0].tags.length - 5}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="self-start sm:self-center">
                          View Details
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              ) : query.trim() !== "" ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No results found. Try a different search term or adjust your filters.
                  </p>
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>

        {results.length === 0 && query.trim() === "" && !loading && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Start Searching</h2>
            <p className="text-muted-foreground">
              Enter a description of what you're looking for to find the most similar models.
            </p>
          </div>
        )}

        <Dialog open={!!selectedModel} onOpenChange={(open) => !open && setSelectedModel(null)}>
          {selectedModel && (
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedModel.model_id}</DialogTitle>
                <DialogDescription>Model details and information</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground">Downloads</h3>
                    <p className="text-2xl font-semibold">{selectedModel.downloads.toLocaleString()}</p>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground">Relevance Score</h3>
                    <p className="text-2xl font-semibold">{(1 - selectedModel.distance).toFixed(4)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Generated Summary</h3>
                  {selectedModel.model_explanation_gemini ? (
                    <div className="text-sm bg-primary/5 dark:bg-primary/10 p-3 rounded-md prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown 
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-md font-bold mt-3 mb-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          a: ({node, ...props}) => <a className="text-primary underline" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/30 pl-4 italic" {...props} />,
                          code: ({node, ...props}) => <code className="bg-muted px-1 py-0.5 rounded" {...props} />,
                          pre: ({node, ...props}) => <pre className="bg-muted p-2 rounded overflow-x-auto my-2" {...props} />
                        }}
                      >
                        {formatModelDescription(selectedModel.model_explanation_gemini)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                        No summary available.
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  {selectedModel.tags && selectedModel.tags.filter(filterTagForDisplay).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.tags
                        .filter(filterTagForDisplay)
                        .map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No tags available</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedModel(null)}>
                  Close
                </Button>
                <Button onClick={() => window.open(`https://huggingface.co/${selectedModel.model_id}`, '_blank')}>
                   Visit Model Page
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Model Search Engine &copy; {new Date().getFullYear()}</p>
          <div className="mt-4 flex justify-center space-x-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://www.linkedin.com/in/shayan-hashemi-5308081b1/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>LinkedIn</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://github.com/Shayan5422" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-muted-foreground hover:text-primary transition-colors">
                  <Github className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>GitHub</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://buymeacoffee.com/shayanhshm" target="_blank" rel="noopener noreferrer" aria-label="Buy Me a Coffee" className="text-muted-foreground hover:text-primary transition-colors">
                  <Coffee className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Buy Me a Coffee</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </footer>
    </div>
    </TooltipProvider>
  )
}
