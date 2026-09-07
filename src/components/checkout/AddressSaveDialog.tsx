import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MapPinPlus, RefreshCw, X } from "lucide-react";

interface AddressSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAddressName?: string;
  onUpdate: () => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function AddressSaveDialog({
  open,
  onOpenChange,
  existingAddressName,
  onUpdate,
  onCreate,
  onCancel,
}: AddressSaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Зберегти адресу?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви змінили дані адреси. Оберіть дію:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-2 my-4">
          {existingAddressName && (
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
                <div className="font-medium">Оновити "{existingAddressName}"</div>
                <div className="text-xs text-muted-foreground">
                  Зберегти зміни в існуючій адресі
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
            <MapPinPlus className="h-4 w-4 mr-3 text-primary" />
            <div className="text-left">
              <div className="font-medium">Створити нову адресу</div>
              <div className="text-xs text-muted-foreground">
                Зберегти як нову адресу в довіднику
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
