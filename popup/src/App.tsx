import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { CrawlTab } from "./components/CrawlTab";
import { JobsTab } from "./components/JobsTab";
import { Toaster } from "./components/ui/toaster";
import { AboutDialog } from "./components/AboutDialog";
import { Button } from "./components/ui/button";
import { MoreVertical } from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState("crawl");
  const [aboutOpen, setAboutOpen] = useState(false);

  // Listen for tab switch events
  useEffect(() => {
    const handleTabSwitch = (event: any) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('switch-tab', handleTabSwitch);
    return () => window.removeEventListener('switch-tab', handleTabSwitch);
  }, []);

  return (
    <div className="w-[400px] h-[600px] bg-background text-foreground flex flex-col">
      <div className="p-4 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Webscribe</h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAboutOpen(true)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="crawl">Capture</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="crawl" className="flex-1 overflow-hidden m-0 mt-4">
            <CrawlTab />
          </TabsContent>

          <TabsContent value="jobs" className="flex-1 overflow-hidden m-0 mt-4">
            <JobsTab />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}

export default App;
