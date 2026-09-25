"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

import type { Category } from "@/types/category";

interface CategoryTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export default function CategoryTable({
  categories,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  const [categoryToDelete, setCategoryToDelete] =
    useState<Category | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      setIsDeleting(true);

      await onDelete(categoryToDelete.id);

      setCategoryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-md border border-leaf-border bg-white">
        <Table className="border border-leaf-border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Photo</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {categories.map((category) => (
              <TableRow
                key={category.id}
                className="border border-leaf-border"
              >
                <TableCell>
                  {category.image ? (
                    <div className="relative size-10 overflow-hidden rounded-md border border-leaf-border">
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <span className="text-leaf-muted text-xs">—</span>
                  )}
                </TableCell>

                <TableCell className="font-medium text-leaf-navy">
                  {category.name}
                </TableCell>

                <TableCell>
                  {category.slug}
                </TableCell>

                <TableCell>
                  <Badge
                    className={
                      category.is_active
                        ? "bg-leaf-soft text-leaf-green-dark hover:bg-leaf-soft"
                        : "bg-yellow-50 text-yellow-700 hover:bg-yellow-50"
                    }
                  >
                    {category.is_active
                      ? "Active"
                      : "Inactive"}
                  </Badge>
                </TableCell>

                <TableCell>
                  {category.display_order}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-leaf-muted"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      className="bg-leaf-bg"
                    >
                      <DropdownMenuItem
                        onClick={() => onEdit(category)}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          setCategoryToDelete(category)
                        }
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setCategoryToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="border-leaf-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-leaf-navy">
              Delete Category?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-leaf-muted">
              Are you sure you want to delete{" "}
              <span className="font-medium text-leaf-navy">
                {categoryToDelete?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}