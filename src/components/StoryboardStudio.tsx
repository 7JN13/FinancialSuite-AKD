import React, { useState } from 'react';
import { 
  Sparkles, 
  Upload, 
  Play, 
  LayoutGrid, 
  Printer, 
  FileSpreadsheet, 
  RefreshCw, 
  ChevronRight, 
  Image as ImageIcon, 
  Trash2, 
  Plus, 
  Edit3, 
  Download, 
  Layers,
  HelpCircle
} from 'lucide-react';
import { StoryboardScene, StoryboardProject } from '../types';

interface StoryboardStudioProps {
  initialProjects: StoryboardProject[];
  onSaveState: (newData: any) => void;
  fullDbState: any;
}

export default function StoryboardStudio({ initialProjects, onSaveState, fullDbState }: StoryboardStudioProps) {
  const [projects, setProjects] = useState<StoryboardProject[]>(initialProjects || []);
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || 'proj-1');
  const [rawScript, setRawScript] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('My Storyboard Adventure');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [bulkSize, setBulkSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [filterText, setFilterText] = useState<string>('');
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Load sample script helper
  const handleLoadSample = () => {
    setProjectName('ARKA Clinic Cinematic Trailer');
    setRawScript(`TITLE: ARKA Dental Clinic Commercial

SCENE 1
We open on a majestic sunrise over the Parañaque skyline. Soft, classy gold rays filter through high-rise windows.
CAMERA ANGLE: High elevation establishing panoramic slow panning.
VISUAL PROMPT: Cinematic photo of warm sunrise over clean modern skyline, rich warm orange and golden rays filtering through building glass, luxury, 8k.

SCENE 2
Interior of the state-of-the-art ARKA clinic. A professional female dentist (Dr. Karla Urbi) wearing clean white lab coat, gold accents, smiles gently at a welcoming child patient.
CAMERA ANGLE: Medium close-up, warm depth of field.
VISUAL PROMPT: Warm indoor lighting inside clean minimalist luxury dental clinic, elegant dentist in medical uniform smiling, dental treatment chair in background, soft white and brass accents.

SCENE 3
Close up on a patient looking at a hand mirror, admiring their sparkling clean and perfectly restored teeth, with tears of confidence in their eyes.
CAMERA ANGLE: Extreme macro closeup on lips and white teeth.
VISUAL PROMPT: Extreme detailed close-up of beautiful teeth smiling in a mirror, sparkling confident smile, studio portrait photography, ultra-realistic.`);
  };

  // Upload script file handler
  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setRawScript(event.target.result);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setProjectName(nameWithoutExt + ' Storyboard');
      }
    };
    reader.readAsText(file);
  };

  // Parse Script with Gemini 3.5 Flash
  const handleParseScript = async () => {
    if (!rawScript.trim()) return;
    setIsParsing(true);
    try {
      const response = await fetch('/api/storyboard/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: rawScript })
      });
      const data = await response.json();
      if (data.success && data.scenes) {
        const newProject: StoryboardProject = {
          id: `proj-${Date.now()}`,
          name: projectName || 'Untitled Storyboard',
          scriptText: rawScript,
          scenes: data.scenes.map((s: any) => ({
            ...s,
            id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            imageSize: bulkSize,
            imageUrl: ''
          })),
          createdAt: new Date().toISOString()
        };

        const updatedProjects = [newProject, ...projects];
        setProjects(updatedProjects);
        setActiveProjectId(newProject.id);

        // Save back to db.json
        const updatedDb = { ...fullDbState, storyboardProjects: updatedProjects };
        onSaveState(updatedDb);
      }
    } catch (err) {
      console.error('Failed script parsing:', err);
    } finally {
      setIsParsing(false);
    }
  };

  // Generate Image for specific Scene Panel using high quality gemini-3.1-flash-image
  const handleGeneratePanelImage = async (sceneId: string) => {
    const projIndex = projects.findIndex(p => p.id === activeProjectId);
    if (projIndex === -1) return;

    const proj = { ...projects[projIndex] };
    const sceneIndex = proj.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const scene = { ...proj.scenes[sceneIndex] };
    scene.isGenerating = true;
    scene.error = undefined;
    scene.warning = undefined;

    proj.scenes[sceneIndex] = scene;
    const updatedProjects = [...projects];
    updatedProjects[projIndex] = proj;
    setProjects(updatedProjects);

    try {
      const response = await fetch('/api/storyboard/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.visualPrompt,
          originalPrompt: scene.description,
          imageSize: scene.imageSize,
          sceneNumber: scene.sceneNumber
        })
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        scene.imageUrl = data.imageUrl;
        if (data.warning) {
          console.warn(data.warning);
          scene.warning = data.warning;
        }
      } else {
        scene.error = 'Failed to generate panel illustration.';
      }
    } catch (err: any) {
      scene.error = err.message || 'Connection error.';
    } finally {
      scene.isGenerating = false;
      proj.scenes[sceneIndex] = scene;
      const finalProjects = [...projects];
      finalProjects[projIndex] = proj;
      setProjects(finalProjects);

      // Save to server
      const updatedDb = { ...fullDbState, storyboardProjects: finalProjects };
      onSaveState(updatedDb);
    }
  };

  // Generate All Panels sequentially
  const handleGenerateAllPanels = async () => {
    if (!activeProject) return;
    for (const s of activeProject.scenes) {
      if (!s.imageUrl) {
        await handleGeneratePanelImage(s.id);
      }
    }
  };

  // Update Scene Value
  const handleUpdateSceneValue = (sceneId: string, field: keyof StoryboardScene, value: any) => {
    const projIndex = projects.findIndex(p => p.id === activeProjectId);
    if (projIndex === -1) return;

    const proj = { ...projects[projIndex] };
    const sceneIndex = proj.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    proj.scenes[sceneIndex] = { ...proj.scenes[sceneIndex], [field]: value };
    const updatedProjects = [...projects];
    updatedProjects[projIndex] = proj;
    setProjects(updatedProjects);

    // Save to server
    const updatedDb = { ...fullDbState, storyboardProjects: updatedProjects };
    onSaveState(updatedDb);
  };

  // Add Empty Scene Panel
  const handleAddScene = () => {
    if (!activeProject) return;
    const newScene: StoryboardScene = {
      id: `sc-${Date.now()}`,
      sceneNumber: activeProject.scenes.length + 1,
      title: `Scene ${activeProject.scenes.length + 1}`,
      description: 'Describe the sequence actions here...',
      cameraAngle: 'Medium Framing Shot',
      visualPrompt: 'Describe illustrations setting, lighting, style...',
      imageSize: bulkSize,
      imageUrl: ''
    };

    const updatedScenes = [...activeProject.scenes, newScene];
    handleUpdateProjectScenes(updatedScenes);
  };

  // Delete Scene Panel
  const handleDeleteScene = (sceneId: string) => {
    if (!activeProject) return;
    const updatedScenes = activeProject.scenes
      .filter(s => s.id !== sceneId)
      .map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    handleUpdateProjectScenes(updatedScenes);
  };

  const handleUpdateProjectScenes = (newScenes: StoryboardScene[]) => {
    const projIndex = projects.findIndex(p => p.id === activeProjectId);
    if (projIndex === -1) return;

    const proj = { ...projects[projIndex], scenes: newScenes };
    const updatedProjects = [...projects];
    updatedProjects[projIndex] = proj;
    setProjects(updatedProjects);

    const updatedDb = { ...fullDbState, storyboardProjects: updatedProjects };
    onSaveState(updatedDb);
  };

  // Delete entire storyboard project
  const handleDeleteProject = (projId: string) => {
    const filtered = projects.filter(p => p.id !== projId);
    setProjects(filtered);
    if (activeProjectId === projId && filtered.length > 0) {
      setActiveProjectId(filtered[0].id);
    }
    const updatedDb = { ...fullDbState, storyboardProjects: filtered };
    onSaveState(updatedDb);
  };

  // Browser Optimized Printing (Export to PDF)
  const handlePrintPDF = () => {
    window.print();
  };

  // Export to Excel-compatible CSV formulation
  const handleExportCSV = () => {
    if (!activeProject) return;
    let csv = 'Scene Number,Title,Screenplay Action Description,Camera Framing,Visual Art Prompt,Resolution,Panel Image State\r\n';
    activeProject.scenes.forEach(s => {
      const row = [
        s.sceneNumber,
        `"${s.title.replace(/"/g, '""')}"`,
        `"${s.description.replace(/"/g, '""')}"`,
        `"${s.cameraAngle.replace(/"/g, '""')}"`,
        `"${s.visualPrompt.replace(/"/g, '""')}"`,
        s.imageSize,
        s.imageUrl ? 'Image Rendered' : 'Pending Generation'
      ];
      csv += row.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${activeProject.name.replace(/\s+/g, '_')}_Storyboard_Manifest.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredScenes = activeProject?.scenes.filter(s => 
    s.title.toLowerCase().includes(filterText.toLowerCase()) || 
    s.description.toLowerCase().includes(filterText.toLowerCase()) ||
    s.cameraAngle.toLowerCase().includes(filterText.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] p-6 font-sans antialiased selection:bg-neutral-200 selection:text-black print:bg-white print:text-black">
      
      {/* HEADER SECTION (HIDDEN IN PRINT) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-[#E4E4E7] gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#18181B] text-white rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tighter uppercase text-[#18181B]">
              Script-to-Storyboard Studio
            </h1>
          </div>
          <p className="text-[#71717A] text-xs font-medium uppercase tracking-wider mt-1.5">
            PRODUCTION PIPELINE FOR MULTIMODAL FRAME GENERATION • v2.4
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button 
            id="btn-print-storyboard"
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-white hover:bg-[#F4F4F5] text-[#18181B] px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border border-[#E4E4E7] shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print PDF Layout
          </button>
          
          <button 
            id="btn-excel-storyboard"
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white hover:bg-[#F4F4F5] text-[#18181B] px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border border-[#E4E4E7] shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Script to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PARSING & PROJECT WORKSPACE (COL-4) (HIDDEN IN PRINT) */}
        <div className="lg:col-span-4 flex flex-col gap-6 print:hidden">
          
          {/* SCRIPTS PROCESSOR */}
          <div className="bg-white border border-[#E4E4E7] rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-2 mb-4">
              <Upload className="w-3.5 h-3.5 text-[#71717A]" /> 1. Upload or Paste Script
            </h3>
            
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">Project Name</label>
                <input 
                  id="in-storyboard-name"
                  type="text" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Creative commercial campaign..."
                  className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-3 py-2 text-xs font-medium text-[#18181B] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Raw Script Text</label>
                  <button 
                    id="btn-load-sample-script"
                    onClick={handleLoadSample} 
                    className="text-[#18181B] hover:underline text-[10px] font-bold uppercase tracking-wider outline-none"
                  >
                    Load Seed Sample
                  </button>
                </div>
                <textarea 
                  id="ta-storyboard-script"
                  rows={8}
                  value={rawScript}
                  onChange={(e) => setRawScript(e.target.value)}
                  placeholder="Paste scene structures, character actions, directions or dialogue here...&#10;Include lines like:&#10;SCENE 1&#10;Framing Action...&#10;CAMERA ANGLE: Closeup"
                  className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg p-3 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">Frame Quality</label>
                  <select 
                    id="sel-storyboard-bulk-size"
                    value={bulkSize} 
                    onChange={(e: any) => setBulkSize(e.target.value)}
                    className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors font-medium"
                  >
                    <option value="512px">Preview (512px)</option>
                    <option value="1K">High-Qual (1K)</option>
                    <option value="2K">Ultra-Qual (2K)</option>
                    <option value="4K">Cinema (4K)</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1 opacity-0">Action</label>
                  <button 
                    id="btn-parse-script"
                    onClick={handleParseScript}
                    disabled={isParsing || !rawScript.trim()}
                    className="w-full bg-[#18181B] hover:bg-[#27272A] text-white disabled:opacity-40 disabled:pointer-events-none font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    {isParsing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                    Parse Scene Sequence
                  </button>
                </div>
              </div>

              <div className="mt-2 border-t border-[#E4E4E7] pt-3 flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Or upload txt:</span>
                <label className="bg-white hover:bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Choose file</span>
                  <input id="file-uploader" type="file" accept=".txt" onChange={handleScriptUpload} className="hidden" />
                </label>
              </div>

            </div>
          </div>

          {/* PROJECT BOARD SELECTION LIST */}
          <div className="bg-white border border-[#E4E4E7] rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-2 mb-4">
              <Layers className="w-3.5 h-3.5 text-[#71717A]" /> Active Storyboards
            </h3>

            {projects.length === 0 ? (
              <p className="text-[#71717A] text-[11px] font-medium uppercase tracking-wider">No active boards.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {projects.map((proj) => (
                  <div 
                    key={proj.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      proj.id === activeProjectId 
                        ? 'bg-[#F4F4F5] border-[#18181B] text-[#18181B]' 
                        : 'bg-white border-[#E4E4E7] text-[#71717A] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <button 
                      id={`project-select-${proj.id}`}
                      onClick={() => setActiveProjectId(proj.id)}
                      className="flex-1 text-xs font-bold text-left truncate outline-none uppercase tracking-tight"
                    >
                      {proj.name}
                      <span className="block text-[10px] text-[#71717A] font-mono font-medium lowercase mt-0.5">
                        {proj.scenes.length} frames • {new Date(proj.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    {projects.length > 1 && (
                      <button 
                        id={`btn-del-project-${proj.id}`}
                        onClick={() => handleDeleteProject(proj.id)}
                        className="p-1 hover:bg-[#F4F4F5] text-[#71717A] hover:text-red-650 rounded transition-colors"
                        title="Delete storyboard project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ACTIVE TIMELINE FRAME CANVAS (COL-8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="bg-white border border-[#E4E4E7] rounded-xl p-6 shadow-xs print:bg-white print:border-none print:shadow-none print:p-0">
                    {/* TIMELINE FILTERS & ACTIONS (HIDDEN IN PRINT) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E4E4E7] pr-1 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2 uppercase tracking-tight">
                  <LayoutGrid className="w-4 h-4 text-[#71717A]" /> {activeProject?.name || 'Storyboard Canvas'}
                </h2>
                <p className="text-[#71717A] text-[10px] font-mono uppercase tracking-wider mt-0.5">
                  Timeline configuration: {filteredScenes.length} frames • 16:9 aspect ratio
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <input 
                  id="in-storyboard-search"
                  type="text"
                  placeholder="Filter scenes..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors w-full sm:w-[130px]"
                />

                <button 
                  id="btn-generate-all-panels"
                  onClick={handleGenerateAllPanels}
                  className="bg-[#18181B] hover:bg-[#27272A] text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                  title="Generate all unresolved illustration cards"
                >
                  <Sparkles className="w-3 h-3 fill-white" /> Render Panels
                </button>

                <button 
                  id="btn-add-empty-scene"
                  onClick={handleAddScene}
                  className="bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-[#18181B]" /> Frame
                </button>
              </div>
            </div>

            {/* MAIN PRINT WATERMARK (SHOWS ONLY IN PRINT) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-3 text-black">
              <h1 className="text-2xl font-bold uppercase tracking-tight">{activeProject?.name} STORYBOARD DIRECTORY</h1>
              <p className="text-xs font-mono uppercase text-slate-650 mt-1">Generated: {new Date(activeProject?.createdAt || '').toDateString()} • System: 7J&amp;Tech Production Suite</p>
            </div>

            {/* SCENE STORYBOARD PANEL GRID */}
            <div className="flex flex-col gap-6">
              {filteredScenes.length === 0 ? (
                <div className="text-center py-12 bg-[#F4F4F5] border border-dashed border-[#E4E4E7] rounded-xl p-6">
                  <ImageIcon className="w-8 h-8 text-[#71717A] mx-auto mb-3" />
                  <p className="text-[#18181B] font-bold text-xs uppercase tracking-wider">No frames matched</p>
                  <p className="text-[#71717A] text-[11px] mt-1 pr-4 pl-4 font-medium uppercase tracking-wider">
                    Please configure scene story prompts or load seed script metadata to begin.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                  {filteredScenes.map((scene) => (
                    <div 
                      key={scene.id}
                      className="bg-white border border-[#E4E4E7] rounded-xl overflow-hidden shadow-xs hover:border-[#A1A1AA] transition-all group flex flex-col print:border-slate-300 print:text-black print:shadow-none print:break-inside-avoid"
                    >
                      {/* STORYBOARD IMAGE WINDOW */}
                      <div className="relative aspect-video w-full bg-[#E4E4E7] flex items-center justify-center overflow-hidden border-b border-[#E4E4E7] print:border-slate-300">
                        {scene.imageUrl ? (
                          <img 
                            src={scene.imageUrl} 
                            alt={scene.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex-1 h-full bg-[#E4E4E7] p-4 flex flex-col justify-between">
                            <div className="flex-1 bg-[#18181B] rounded-lg mb-3 flex flex-col items-center justify-center text-[#A1A1AA] p-4 text-center">
                              <span className="p-2 bg-neutral-800 rounded-full text-[#A1A1AA] mb-2">
                                <ImageIcon className="w-5 h-5" />
                              </span>
                              <span className="text-[11px] italic font-medium">PENDING ILLUSTRATION RENDER</span>
                              <p className="text-[9px] text-[#71717A] mt-1 max-w-[200px] truncate">
                                {scene.visualPrompt}
                              </p>
                            </div>
                            <div className="flex justify-between items-center text-[#18181B]">
                              <span className="text-[10px] font-bold uppercase tracking-wider">SCENE {scene.sceneNumber}</span>
                              <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-white border border-[#D4D4D8] px-2 py-0.5 rounded shadow-xs">16:9 FORMAT</span>
                            </div>
                          </div>
                        )}

                        {/* GENERATIVE PROCESS BLUR OVERLAY */}
                        {scene.isGenerating && (
                          <div className="absolute inset-0 bg-[#18181B]/95 flex flex-col items-center justify-center p-4 backdrop-blur-xs">
                            <RefreshCw className="w-6 h-6 text-white animate-spin mb-3" />
                            <p className="text-xs font-bold text-white uppercase tracking-wider animate-pulse">Invoking Gemini Image AI...</p>
                            <p className="text-[#AEAEAE] font-mono text-[9px] mt-1">Formulating pixels @ {scene.imageSize}</p>
                          </div>
                        )}

                        {/* HOVER QUICK TRIGGER BUTTONS (HIDDEN IN PRINT) */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                          <button 
                            id={`btn-regen-image-${scene.id}`}
                            onClick={() => handleGeneratePanelImage(scene.id)}
                            className="px-2.5 py-1 bg-[#18181B]/90 hover:bg-[#18181B] text-white border border-neutral-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            title="Generate Panel Art"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Render</span>
                          </button>
                        </div>

                        {/* CORNER SCENE BADGE */}
                        <div className="absolute top-3 left-3 px-2 py-0.5 bg-white border border-[#E4E4E7] text-[#18181B] font-mono font-bold text-[10px] rounded shadow-xs">
                          FRAME 0{scene.sceneNumber}
                        </div>

                        {scene.imageSize && scene.imageUrl && (
                          <div className="absolute bottom-3 right-3 px-1.5 py-0.5 bg-[#18181B] text-white text-[9px] font-mono rounded select-none">
                            {scene.imageSize}
                          </div>
                        )}
                      </div>

                      {/* SCENE CARD METADATA WRAPPER */}
                      <div className="p-4 flex-1 flex flex-col justify-between bg-white text-[#18181B]">
                        
                        <div>
                          {editingSceneId === scene.id ? (
                            <div className="flex flex-col gap-2.5 mb-2.5 print:hidden">
                              <input 
                                id={`input-title-${scene.id}`}
                                type="text"
                                value={scene.title}
                                onChange={(e) => handleUpdateSceneValue(scene.id, 'title', e.target.value)}
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1 text-xs font-bold text-[#18181B] outline-none"
                              />
                              <textarea 
                                id={`textarea-desc-${scene.id}`}
                                value={scene.description}
                                rows={2}
                                onChange={(e) => handleUpdateSceneValue(scene.id, 'description', e.target.value)}
                                placeholder="Narrative screenplay action"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg p-1.5 text-xs text-[#18181B] outline-none resize-none"
                              />
                              <input 
                                id={`input-camera-${scene.id}`}
                                type="text"
                                value={scene.cameraAngle}
                                onChange={(e) => handleUpdateSceneValue(scene.id, 'cameraAngle', e.target.value)}
                                placeholder="Camera details"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1 text-xs font-mono text-[#71717A]"
                              />
                              <textarea 
                                id={`textarea-prompt-${scene.id}`}
                                value={scene.visualPrompt}
                                rows={2}
                                onChange={(e) => handleUpdateSceneValue(scene.id, 'visualPrompt', e.target.value)}
                                placeholder="Visual AI prompt details"
                                className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg p-1.5 text-xs font-mono text-[#71717A] resize-none leading-tight"
                              />
                            </div>
                          ) : (
                            <div className="mb-3">
                              <h4 className="text-sm font-extrabold uppercase tracking-tight text-[#18181B] group-hover:text-neutral-700 transition-colors">
                                {scene.title}
                              </h4>
                              <p className="text-xs text-[#71717A] leading-relaxed mt-1.5 min-h-[35px]">
                                {scene.description}
                              </p>
                              
                              <div className="mt-3 bg-[#F4F4F5] rounded-lg py-2 px-3 border border-[#E4E4E7] print:bg-slate-150 print:text-black">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-[#71717A] font-mono block">Camera framing:</span>
                                <span className="text-xs text-[#18181B] font-bold uppercase tracking-tight font-sans">{scene.cameraAngle}</span>
                              </div>
                            </div>
                          )}

                          {scene.error && (
                            <p className="text-red-650 text-[10px] font-bold flex items-center gap-1 my-2 uppercase">
                              ⚠ {scene.error}
                            </p>
                          )}

                          {scene.warning && (
                            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-2.5 my-2.5 text-[#92400E] text-[10px] font-sans flex items-start gap-1.5 print:hidden">
                              <span className="text-amber-500 font-bold leading-none text-xs">⚠</span>
                              <div>
                                <strong className="font-extrabold uppercase text-[9px] tracking-wide block mb-0.5 text-amber-800">API Quota Information:</strong>
                                {scene.warning}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CARD ACTION TOOLBAR (HIDDEN IN PRINT) */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E4E4E7] print:hidden">
                          
                          <div className="flex items-center gap-2">
                            <button 
                              id={`btn-edit-scene-${scene.id}`}
                              onClick={() => setEditingSceneId(editingSceneId === scene.id ? null : scene.id)}
                              className="text-[#71717A] hover:text-[#18181B] text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 outline-none"
                            >
                              <Edit3 className="w-3 h-3" />
                              {editingSceneId === scene.id ? 'Save' : 'Edit Frame'}
                            </button>

                            {editingSceneId === scene.id && (
                              <div className="flex items-center gap-1.5 ml-2 border-l border-[#E4E4E7] pl-2 font-mono">
                                <span className="text-[10px] text-[#71717A]">Res:</span>
                                <select 
                                  id={`select-res-${scene.id}`}
                                  value={scene.imageSize} 
                                  onChange={(e: any) => handleUpdateSceneValue(scene.id, 'imageSize', e.target.value)}
                                  className="bg-white border border-[#E4E4E7] text-[10px] rounded text-[#18181B] p-0.5 outline-none"
                                >
                                  <option value="512px">512</option>
                                  <option value="1K">1K</option>
                                  <option value="2K">2K</option>
                                  <option value="4K">4K</option>
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              id={`btn-single-gen-${scene.id}`}
                              onClick={() => handleGeneratePanelImage(scene.id)}
                              disabled={scene.isGenerating}
                              className="px-2.5 py-1 bg-[#18181B] hover:bg-[#27272A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" /> Render Art
                            </button>
                            
                            <button 
                              id={`btn-del-scene-${scene.id}`}
                              onClick={() => handleDeleteScene(scene.id)}
                              className="p-1 hover:bg-[#F4F4F5] text-[#71717A] hover:text-red-650 rounded transition-colors"
                              title="Delete scene template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* DOCUMENTATION HELPER DIALOGUE */}
          <div className="bg-white border border-[#E4E4E7] rounded-xl p-5 flex gap-4 print:hidden">
            <span className="p-2 bg-[#F4F4F5] rounded-xl self-start">
              <HelpCircle className="w-4 h-4 text-[#71717A]" />
            </span>
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#18181B]">Pro-pipeline tips for visual consistency</h5>
              <p className="text-[#71717A] text-[11px] mt-1.5 leading-relaxed font-medium">
                Our high-conformance Gemini image output supports resolution renders up to 4K. Match color continuity across multiple timeline frames by referencing standard color tokens (e.g., "warm studio key light, classic medium-shot film format, volumetric daylight beams, golden sunset tint") inside your customized visual prompts.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
