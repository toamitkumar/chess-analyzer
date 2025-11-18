import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, FileText, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Upload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith(".pgn")
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      toast.success(`${droppedFiles.length} PGN file(s) added`);
    } else {
      toast.error("Please upload PGN files only");
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.name.endsWith(".pgn")
      );
      if (selectedFiles.length > 0) {
        setFiles(prev => [...prev, ...selectedFiles]);
        toast.success(`${selectedFiles.length} PGN file(s) added`);
      } else {
        toast.error("Please upload PGN files only");
      }
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploadStatus("uploading");
    
    // Simulate upload
    setTimeout(() => {
      setUploadStatus("success");
      toast.success(`Successfully processed ${files.length} game(s)`);
      
      // Reset after success
      setTimeout(() => {
        setFiles([]);
        setUploadStatus("idle");
      }, 2000);
    }, 2000);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    toast.info("File removed");
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Upload Games</h1>
          <p className="text-muted-foreground">Import PGN files to analyze your chess games</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>PGN File Upload</CardTitle>
            <CardDescription>
              Upload your chess games in PGN format for comprehensive analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={cn(
                "relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all",
                dragActive
                  ? "border-accent bg-accent/10"
                  : "border-border bg-muted/20 hover:border-accent/50 hover:bg-muted/40"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pgn"
                onChange={handleFileInput}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-accent/10 p-6">
                  <UploadIcon className="h-12 w-12 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Drop your PGN files here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse files
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports multiple file selection • Max 10MB per file
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-accent" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploadStatus === "uploading"}
              className="w-full"
              size="lg"
            >
              {uploadStatus === "uploading" ? (
                <>Processing...</>
              ) : uploadStatus === "success" ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Upload Complete
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-5 w-5" />
                  Analyze {files.length} Game{files.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-foreground">
              <li className="flex gap-2">
                <span className="font-semibold text-accent">1.</span>
                <span>Upload your PGN files containing chess games</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-accent">2.</span>
                <span>Our engine analyzes each move for accuracy and mistakes</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-accent">3.</span>
                <span>View detailed insights on the dashboard and individual game pages</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Upload;
