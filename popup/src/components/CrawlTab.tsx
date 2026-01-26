import { useState, useEffect, useRef } from 'react';
import { useCrawl } from '@/hooks/useCrawl';
import { useToast } from '@/hooks/use-toast';
import { contentPickerAPI, PickedContent } from '@/lib/service-worker-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Loader2, AlertCircle, ChevronDown, ChevronUp, X, Plus, AlertTriangle, MousePointer2, Save, Globe } from 'lucide-react';

export function CrawlTab() {
  const [urls, setUrls] = useState(['']);
  const [crawlMode, setCrawlMode] = useState<'crawl-url' | 'pick-content'>('crawl-url');
  const [pickedContent, setPickedContent] = useState<PickedContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skipCache, setSkipCache] = useState(false);
  const [maxWorkers, setMaxWorkers] = useState(5);
  const [enablePageLimit, setEnablePageLimit] = useState(false);
  const [pageLimit, setPageLimit] = useState(100);
  const [strictPathMatching, setStrictPathMatching] = useState(true);
  const [useIncognito, setUseIncognito] = useState(false);
  const [followExternalLinks, setFollowExternalLinks] = useState(false);
  const [maxExternalHops, setMaxExternalHops] = useState(1);
  const [showIncognitoWarning, setShowIncognitoWarning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { isActive, progress, error, startCrawl, cancelCrawl } = useCrawl();
  const { toast } = useToast();
  const wasActiveRef = useRef(false);
  const wasCancelledRef = useRef(false);

  // URL list management functions
  const addUrl = () => {
    setUrls([...urls, '']);
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  // Fill input with the current tab's URL
  const useCurrentPageUrl = async (index: number, silent = false) => {
    try {
      // @ts-ignore - Chrome extension API
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      let activeTab = tabs[0];

      // Fallback to current window if no tab found
      if (!activeTab) {
        // @ts-ignore - Chrome extension API
        const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTab = currentTabs[0];
      }

      if (!activeTab?.url) {
        if (!silent) {
          toast({
            variant: "destructive",
            title: "Cannot get current page",
            description: "No active tab found or URL is not accessible"
          });
        }
        return;
      }

      const url = activeTab.url;

      // Check if it's a valid http/https URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (!silent) {
          toast({
            variant: "destructive",
            title: "Invalid page",
            description: "Current page is not a web page (http/https)"
          });
        }
        return;
      }

      updateUrl(index, url);
    } catch (err) {
      console.error('Failed to get current tab URL:', err);
      if (!silent) {
        toast({
          variant: "destructive",
          title: "Failed to get URL",
          description: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
  };

  // Extract URLs from text using a robust regex
  const extractUrls = (text: string): string[] => {
    // Comprehensive URL regex that handles:
    // - http and https protocols
    // - domains with subdomains (including localhost)
    // - IP addresses
    // - ports (e.g., :8080)
    // - paths with various characters
    // - query parameters (e.g., ?foo=bar&baz=qux)
    // - fragments/anchors (e.g., #section)
    // - encoded characters (e.g., %20)
    const urlRegex = /https?:\/\/(?:localhost|(?:[\w-]+\.)+[\w-]+|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/[^\s<>"'`\[\]{}|\\^]*)?/gi;

    const matches = text.match(urlRegex) || [];

    // Clean up and deduplicate
    const cleaned = matches.map(url => {
      // Remove trailing punctuation that's unlikely to be part of the URL
      // but preserve query params (?), fragments (#), and encoded chars (%)
      return url.replace(/[.,;:!?)>\]']+$/, '');
    });

    // Deduplicate and filter empty
    return [...new Set(cleaned)].filter(url => url.length > 0);
  };

  // Handle paste to support multiple URLs
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    const extractedUrls = extractUrls(pastedText);

    if (extractedUrls.length === 0) {
      // No URLs found, let normal paste happen
      return;
    }

    e.preventDefault();

    if (extractedUrls.length === 1) {
      // One URL found, just update this input
      updateUrl(index, extractedUrls[0]);
    } else {
      // Multiple URLs found - replace current input and add new rows
      const newUrls = [...urls];
      newUrls.splice(index, 1, ...extractedUrls);
      setUrls(newUrls);

      toast({
        title: `${extractedUrls.length} URLs detected`,
        description: "Multiple URLs have been added from your paste"
      });
    }
  };

  const handleStartCrawl = async () => {
    // Filter out empty URLs and trim
    const validUrls = urls
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (validUrls.length === 0) return;

    // Set loading state immediately for instant feedback
    setIsStarting(true);

    try {
      const options = {
        skipCache,
        maxWorkers,
        pageLimit: enablePageLimit ? pageLimit : null,
        strictPathMatching,
        useIncognito,
        followExternalLinks,
        maxExternalHops: followExternalLinks ? maxExternalHops : 1
      };

      // Pass array of URLs if multiple, single URL if just one
      const urlsToPass = validUrls.length === 1 ? validUrls[0] : validUrls;

      // Show toast notification for immediate feedback
      toast({
        title: "Starting capture...",
        description: `Capturing pages from ${validUrls.length} base path${validUrls.length > 1 ? 's' : ''}`
      });

      await startCrawl(urlsToPass, options);

      // Crawl started successfully - loading state will be cleared by useEffect
    } catch (err) {
      console.error('Failed to start capture:', err);
      setIsStarting(false);

      toast({
        variant: "destructive",
        title: "Failed to start capture",
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    }
  };

  const handleCancel = async () => {
    try {
      wasCancelledRef.current = true;
      await cancelCrawl();
    } catch (err) {
      console.error('Failed to cancel crawl:', err);
      wasCancelledRef.current = false;
    }
  };

  // Handler for starting content selection
  const handleStartContentSelection = async () => {
    try {
      // Clear any existing picked content before starting new selection
      if (pickedContent) {
        setPickedContent(null);
        await contentPickerAPI.clearPendingContent();
      }

      // Start the content picker (injects script into active tab)
      const result = await contentPickerAPI.startPicker();

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Cannot start content picker",
          description: result.error
        });
        return;
      }

      // Close the popup - the picker will show a notification when content is selected
      window.close();

    } catch (err) {
      console.error('Failed to start content picker:', err);
      toast({
        variant: "destructive",
        title: "Failed to start content picker",
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    }
  };

  // Handler for saving picked content as a job with single page
  const handleSavePickedContent = async () => {
    if (!pickedContent) return;

    setIsSaving(true);
    try {
      const result = await contentPickerAPI.savePickedContent(pickedContent);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        variant: "success",
        title: "Content Saved",
        description: `Saved content from ${pickedContent.url}`
      });

      // Clear picked content after saving
      setPickedContent(null);
      await contentPickerAPI.clearPendingContent();

    } catch (err) {
      console.error('Failed to save picked content:', err);
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error occurred"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle incognito checkbox - check if extension is allowed in incognito
  const handleIncognitoChange = async (checked: boolean) => {
    if (checked) {
      // Check if extension is allowed in incognito mode
      const isAllowed = await new Promise<boolean>((resolve) => {
        chrome.extension.isAllowedIncognitoAccess((allowed) => {
          resolve(allowed);
        });
      });

      if (!isAllowed) {
        // Show warning modal instead of enabling
        setShowIncognitoWarning(true);
        return;
      }
    }
    setUseIncognito(checked);
  };

  const progressPercentage = progress.pagesFound > 0
    ? (progress.pagesProcessed / progress.pagesFound) * 100
    : 0;

  // Clear loading state when crawl becomes active
  useEffect(() => {
    if (isActive && isStarting) {
      setIsStarting(false);
    }
  }, [isActive, isStarting]);

  // Show toast when crawl completes or is cancelled (transitions from active to inactive)
  useEffect(() => {
    if (wasActiveRef.current && !isActive && progress.pagesProcessed > 0) {
      if (wasCancelledRef.current) {
        // Capture was cancelled by user
        toast({
          variant: "warning",
          title: "Capture Cancelled",
          description: `Stopped after capturing ${progress.pagesProcessed} page${progress.pagesProcessed !== 1 ? 's' : ''}`
        });
        wasCancelledRef.current = false;
      } else {
        // Capture completed naturally
        toast({
          variant: "success",
          title: "Capture Complete!",
          description: `Successfully captured ${progress.pagesProcessed} pages`
        });
      }
    }
    // Update the ref for next render
    wasActiveRef.current = isActive;
  }, [isActive, progress.pagesProcessed, toast]);

  // Check for pending picked content and restore crawl mode on mount
  useEffect(() => {
    const initializeState = async () => {
      try {
        // @ts-ignore - Chrome extension API
        const stored: { pickedContent?: PickedContent; crawlMode?: string } = await chrome.storage.local.get(['pickedContent', 'crawlMode']);

        // Restore crawl mode if saved
        if (stored.crawlMode === 'pick-content' || stored.crawlMode === 'crawl-url') {
          setCrawlMode(stored.crawlMode);
        }

        // Restore picked content if exists
        if (stored.pickedContent?.url) {
          setPickedContent(stored.pickedContent);
          setCrawlMode('pick-content'); // Ensure we're in pick-content mode if content exists
        }

        // Auto-prefill current browser URL when in Capture Site mode
        // Only if the first URL field is empty (don't overwrite user input)
        const isCaptureSiteMode = stored.crawlMode === 'crawl-url' || !stored.crawlMode;
        const isFirstUrlEmpty = urls[0].trim() === '';

        if (isCaptureSiteMode && isFirstUrlEmpty) {
          // Auto-fill with current tab URL (silent mode to avoid error toasts on auto-prefill)
          await useCurrentPageUrl(0, true);
        }
      } catch (err) {
        console.error('[CrawlTab] Failed to initialize state:', err);
      }
    };

    initializeState();
  }, []);

  // Persist crawl mode changes to storage
  useEffect(() => {
    // @ts-ignore - Chrome extension API
    chrome.storage.local.set({ crawlMode });
  }, [crawlMode]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pb-16">{/* Add padding bottom for floating button */}
        {/* Show loading state while initializing */}
        {isStarting && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Initializing...</p>
                  <p className="text-sm text-muted-foreground">
                    Setting up workers and discovering initial URLs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isActive && !isStarting && (
          <Card>
            <CardHeader className="space-y-3">
              {/* Crawl Mode Selection */}
              <RadioGroup
                value={crawlMode}
                onValueChange={(value) => setCrawlMode(value as 'crawl-url' | 'pick-content')}
                className="flex items-center gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="crawl-url" id="crawl-url" />
                  <Label htmlFor="crawl-url" className="cursor-pointer font-normal">Capture Site</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pick-content" id="pick-content" />
                  <Label htmlFor="pick-content" className="cursor-pointer font-normal">Pick Content</Label>
                </div>
              </RadioGroup>
              <div>
                <CardTitle className="text-lg">
                  {crawlMode === 'crawl-url' ? 'Capture Web Pages' : 'Pick Content'}
                </CardTitle>
                <CardDescription>
                  {crawlMode === 'crawl-url'
                    ? 'Paste multiple URLs at once or add them one by one'
                    : 'Select and extract content from any web page'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

            {/* Crawl URL Mode */}
            {crawlMode === 'crawl-url' && (
            <div className="space-y-3">
              <Label>Target URL{urls.length > 1 ? 's' : ''}</Label>
              {urls.map((url, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input
                    type="url"
                    placeholder={index === 0 ? "https://docs.stripe.com/api" : "https://docs.stripe.com/sdk"}
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartCrawl()}
                    onPaste={(e) => handlePaste(e, index)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => useCurrentPageUrl(index)}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-primary shrink-0"
                    title="Use current page URL"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                  {urls.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUrl(index)}
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUrl}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another URL
              </Button>
            </div>
            )}

            {/* Advanced Options - only show in crawl-url mode */}
            {crawlMode === 'crawl-url' && (
            <div className="border rounded-lg p-3 space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-sm font-medium"
              >
                <span>Advanced Options</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2 border-t">
                  {/* Concurrent Workers */}
                  <div className="space-y-2">
                    <Label htmlFor="maxWorkers" className="text-sm font-medium">
                      Concurrent Tabs (Workers)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="maxWorkers"
                        type="number"
                        min={1}
                        max={10}
                        value={maxWorkers}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= 10) {
                            setMaxWorkers(val);
                          }
                        }}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        tabs (1-10, default: 5)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Number of browser tabs opened simultaneously to capture pages. More tabs = faster capturing but higher resource usage.
                    </p>
                  </div>

                  {/* Page Limit */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enablePageLimit"
                        checked={enablePageLimit}
                        onCheckedChange={(checked) => setEnablePageLimit(checked as boolean)}
                      />
                      <Label htmlFor="enablePageLimit" className="text-sm font-medium cursor-pointer">
                        Limit Number of Pages
                      </Label>
                    </div>
                    {enablePageLimit && (
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center gap-3">
                          <Input
                            id="pageLimit"
                            type="number"
                            min={1}
                            value={pageLimit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val >= 1) {
                                setPageLimit(val);
                              }
                            }}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">pages maximum</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Stop after processing this many pages. Job will be marked as completed when limit is reached.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Strict Path Matching */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="strictPathMatching"
                        checked={strictPathMatching}
                        onCheckedChange={(checked) => setStrictPathMatching(checked as boolean)}
                      />
                      <Label htmlFor="strictPathMatching" className="text-sm font-medium cursor-pointer">
                        Strict Path Matching
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Only capture pages under the exact path hierarchy. When enabled, <code className="text-xs bg-muted px-1 py-0.5 rounded">/financial-apis</code> will match <code className="text-xs bg-muted px-1 py-0.5 rounded">/financial-apis/overview</code> but NOT <code className="text-xs bg-muted px-1 py-0.5 rounded">/financial-apis-blog</code>.
                    </p>
                  </div>

                  {/* Force Refresh Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="skipCache"
                        checked={skipCache}
                        onCheckedChange={(checked) => setSkipCache(checked as boolean)}
                      />
                      <Label htmlFor="skipCache" className="text-sm font-medium cursor-pointer">
                        Force Refresh (Skip Cache)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Re-capture pages even if already in database. Use this to refresh content from previously captured sites.
                    </p>
                  </div>

                  {/* Incognito Mode */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="useIncognito"
                        checked={useIncognito}
                        onCheckedChange={(checked) => handleIncognitoChange(checked as boolean)}
                      />
                      <Label htmlFor="useIncognito" className="text-sm font-medium cursor-pointer">
                        Incognito Mode
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Capture in a new incognito window for a clean session (no cookies, cache, or logged-in states).
                    </p>
                  </div>

                  {/* Follow External Links */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="followExternalLinks"
                        checked={followExternalLinks}
                        onCheckedChange={(checked) => setFollowExternalLinks(checked as boolean)}
                      />
                      <Label htmlFor="followExternalLinks" className="text-sm font-medium cursor-pointer">
                        Follow External Links
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Also follow links that point outside the base URL path(s). Useful for documentation that spans multiple domains or sections.
                    </p>
                    {followExternalLinks && (
                      <div className="pl-6 space-y-2 pt-2">
                        <div className="flex items-center gap-3">
                          <Label htmlFor="maxExternalHops" className="text-sm whitespace-nowrap">
                            Max hops:
                          </Label>
                          <Input
                            id="maxExternalHops"
                            type="number"
                            min={1}
                            max={5}
                            value={maxExternalHops}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val >= 1 && val <= 5) {
                                setMaxExternalHops(val);
                              }
                            }}
                            className="w-16"
                          />
                          <span className="text-sm text-muted-foreground">(1-5)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          How many levels deep to follow external links. <span className="font-medium">1</span> = only direct links from base pages, <span className="font-medium">2</span> = also links from those pages, etc.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
            )}

            {/* Error display - only show in crawl-url mode */}
            {crawlMode === 'crawl-url' && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Tip - only show in crawl-url mode */}
            {crawlMode === 'crawl-url' && (
              <p className="text-xs text-muted-foreground">
                💡 Tip: Only one capture allowed at a time
              </p>
            )}

            {/* Pick Content Mode */}
            {crawlMode === 'pick-content' && (
              <div className="space-y-4">
                {/* Instructions - shown when no content selected */}
                {!pickedContent && (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      <MousePointer2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <p>
                        Click <span className="font-medium text-foreground">"Start Selecting Content"</span> to begin selecting content on the current web page.
                      </p>
                    </div>
                    <div className="pl-8 space-y-2">
                      <p>When you select content:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Content is extracted as HTML, Markdown, and plain text</li>
                        <li>Markdown is automatically copied to your clipboard</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Status indicator - shown when content is selected */}
                {pickedContent && (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Content ready to save
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      From: {pickedContent.url}
                    </p>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
        )}

      {isActive && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Capture in Progress
                </CardTitle>
                <CardDescription className="mt-1">
                  Extracting content from {urls.filter(u => u.trim()).length} base path{urls.filter(u => u.trim()).length > 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {progress.pagesProcessed} / {progress.pagesFound} pages
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {progress.pagesFound}
                </div>
                <div className="text-xs text-muted-foreground">Found</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">
                  {progress.pagesProcessed}
                </div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">
                  {progress.queueSize}
                </div>
                <div className="text-xs text-muted-foreground">In Queue</div>
              </div>
            </div>

            {progress.inProgress && progress.inProgress.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Currently Processing:</div>
                <div className="space-y-1">
                  {progress.inProgress.slice(0, 3).map((pageUrl, index) => (
                    <div key={index} className="text-xs text-muted-foreground truncate flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      </Badge>
                      {pageUrl}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancel}
            >
              Stop Capture
            </Button>

            <Alert>
              <AlertDescription className="text-xs">
                ℹ️ You can close this popup. Capture will continue in the background.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Floating button(s) at bottom - only show when not crawling */}
      {!isActive && (
        <div className="absolute bottom-4 left-4 right-4">
          {/* Crawl URL mode OR Pick Content mode without content: single button */}
          {(crawlMode === 'crawl-url' || !pickedContent) && (
            <Button
              className="w-full shadow-lg"
              size="lg"
              onClick={crawlMode === 'crawl-url' ? handleStartCrawl : handleStartContentSelection}
              disabled={
                crawlMode === 'crawl-url'
                  ? urls.filter(u => u.trim()).length === 0 || isActive || isStarting
                  : false
              }
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : crawlMode === 'crawl-url' ? (
                'Start Capture'
              ) : (
                <>
                  <MousePointer2 className="h-4 w-4 mr-2" />
                  Start Selecting Content
                </>
              )}
            </Button>
          )}

          {/* Pick Content mode with content: two buttons side by side */}
          {crawlMode === 'pick-content' && pickedContent && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 shadow-lg"
                size="lg"
                onClick={handleStartContentSelection}
              >
                <MousePointer2 className="h-4 w-4 mr-2" />
                Reselect
              </Button>
              <Button
                className="flex-1 shadow-lg"
                size="lg"
                onClick={handleSavePickedContent}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Selection
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Incognito Mode Warning Dialog */}
      <Dialog open={showIncognitoWarning} onOpenChange={setShowIncognitoWarning}>
        <DialogContent centered className="max-w-[340px] sm:max-w-[400px]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Incognito Mode Not Available
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm">
                To use Incognito Mode, you need to enable this extension in Chrome's incognito settings.
              </p>
              <div className="bg-muted/50 p-3 rounded-md space-y-2">
                <p className="text-sm font-medium">How to enable:</p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Go to <code className="bg-muted px-1 py-0.5 rounded text-xs">chrome://extensions</code></li>
                  <li>Find "Webscribe" and click "Details"</li>
                  <li>Enable "Allow in Incognito"</li>
                </ol>
              </div>
            </div>
          </DialogDescription>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowIncognitoWarning(false)}
            >
              Got it
            </Button>
            <Button
              onClick={() => {
                // Open the extension settings page
                chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
                setShowIncognitoWarning(false);
              }}
            >
              Open Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
