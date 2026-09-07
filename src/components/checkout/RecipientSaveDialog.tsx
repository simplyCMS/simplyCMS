import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, RefreshCw, X } from "lucide-react";

interface RecipientSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRecipientName?: string;
  onUpdate: () => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function RecipientSaveDialog({
  open,
  onOpenChange,
  existingRecipientName,
  onUpdate,
  onCreate,
  onCancel,
}: RecipientSaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Зберегти дані отримувача?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви змінили дані отримувача. Оберіть дію:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-2 my-4">
          {existingRecipientName && (
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4"
              onClick={() => {
                onUpdate();
                onOpenChange(false);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-3 text-primary" />
              <div className="text-left">
                <div className="font-medium">Оновити "{existingRecipientName}"</div>
                <div className="text-xs text-muted-foreground">
                  Зберегти зміни в існуючому контакті
                </div>
              </div>
            </Button>
          )}
          
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4"
            onClick={() => {
              onCreate();
              onOpenChange(false);
            }}
          >
            <UserPlus className="h-4 w-4 mr-3 text-primary" />
            <div className="text-left">
              <div className="font-medium">Створити нового отримувача</div>
              <div className="text-xs text-muted-foreground">
                Зберегти як новий контакт в довіднику
              </div>
            </div>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Скасувати зміни
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
