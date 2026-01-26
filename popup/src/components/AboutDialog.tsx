import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VERSION } from "../version";
import { BookOpen, Globe, Mail, LifeBuoy, Shield, Github, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportPage } from "./SupportPage";
import { useState } from "react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AboutMenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick?: () => void;
}

function AboutMenuItem({ icon: Icon, title, description, onClick }: AboutMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-lg border border-border",
        "hover:bg-accent hover:border-accent-foreground/20",
        "transition-colors text-left"
      )}
    >
      <div className="p-3 rounded-full bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const [showSupportPage, setShowSupportPage] = useState(false);

  const handleGuideClick = () => {
    window.open('https://bobninja.com/tools/webscribe/guide/', '_blank');
  };

  const handleWebsiteClick = () => {
    window.open('https://bobninja.com/tools/webscribe/', '_blank');
  };

  const handleContactSupportClick = () => {
    window.open('https://bobninja.com/tools/webscribe/support/', '_blank');
  };

  const handleGitHubClick = () => {
    window.open('https://github.com/storyleaps/bobninja-webscribe', '_blank');
  };

  const handleDiscussionsClick = () => {
    window.open('https://github.com/storyleaps/bobninja-webscribe/discussions', '_blank');
  };

  const handleDiagnosticsClick = () => {
    setShowSupportPage(true);
  };

  const handlePrivacyClick = () => {
    window.open('https://bobninja.com/tools/webscribe/privacy/', '_blank');
  };

  const handleSupportBack = () => {
    setShowSupportPage(false);
  };

  // Reset support page when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowSupportPage(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[400px] h-[600px] max-w-none p-0 overflow-hidden" centered aria-describedby={undefined}>
        <DialogTitle className="sr-only">About Webscribe</DialogTitle>

        {/* Main content */}
        <div className={cn(
          "flex flex-col h-full p-6 transition-transform duration-300 ease-in-out",
          showSupportPage ? "-translate-x-full" : "translate-x-0"
        )}>
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <AboutMenuItem
              icon={BookOpen}
              title="How-to Guide"
              description="Learn how to use Webscribe"
              onClick={handleGuideClick}
            />

            <AboutMenuItem
              icon={Globe}
              title="Website"
              description="Visit the Webscribe homepage"
              onClick={handleWebsiteClick}
            />

            <AboutMenuItem
              icon={Mail}
              title="Contact Support"
              description="Get help or report issues"
              onClick={handleContactSupportClick}
            />

            <AboutMenuItem
              icon={Github}
              title="GitHub"
              description="Report bugs, request features, view source"
              onClick={handleGitHubClick}
            />

            <AboutMenuItem
              icon={MessageCircle}
              title="Discussions"
              description="Ask questions, share ideas, get help"
              onClick={handleDiscussionsClick}
            />

            <div className="pt-3 border-t border-border">
              <AboutMenuItem
                icon={LifeBuoy}
                title="Diagnostics"
                description="View error logs and generate reports"
                onClick={handleDiagnosticsClick}
              />

              <div className="mt-3">
                <AboutMenuItem
                  icon={Shield}
                  title="Privacy Policy"
                  description="See how your data is protected"
                  onClick={handlePrivacyClick}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Webscribe — Version {VERSION}
          </div>
        </div>

        {/* Support page (slides in from right) */}
        <SupportPage open={showSupportPage} onBack={handleSupportBack} />
      </DialogContent>
    </Dialog>
  );
}
