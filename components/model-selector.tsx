"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { 
  SUPPORTED_MODELS, 
  MODEL_DISPLAY_NAMES, 
  MODEL_LOGOS,
  type SupportedModel 
} from "@/lib/constants";

interface ModelSelectorProps {
  selectedModel: SupportedModel;
  onModelChange: (model: SupportedModel) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  return (
    <Select value={selectedModel} onValueChange={(value) => onModelChange(value as SupportedModel)}>
      <SelectTrigger className="w-auto border-0 bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none h-8 px-2 cursor-pointer shrink-0 hover:bg-accent rounded-md transition-colors">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Image
              src={MODEL_LOGOS[selectedModel]}
              alt={MODEL_DISPLAY_NAMES[selectedModel]}
              width={18}
              height={18}
              className="rounded-sm"
            />
            <span className="text-sm text-muted-foreground hidden sm:inline">{MODEL_DISPLAY_NAMES[selectedModel]}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {SUPPORTED_MODELS.map((model) => (
          <SelectItem key={model} value={model} className="cursor-pointer">
            <div className="flex items-center gap-2">
              <Image
                src={MODEL_LOGOS[model]}
                alt={MODEL_DISPLAY_NAMES[model]}
                width={18}
                height={18}
                className="rounded-sm"
              />
              <span>{MODEL_DISPLAY_NAMES[model]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
