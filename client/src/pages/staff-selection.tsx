import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, User } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaffSelectionProps {
  onStaffSelected: (staff: StaffWithDetails) => void;
}

export default function StaffSelection({ onStaffSelected }: StaffSelectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: staffList, isLoading } = useQuery<StaffWithDetails[]>({
    queryKey: ["/api/staff"],
  });

  const filteredStaff = (staffList?.filter((staff) =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.spu.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Select Your Profile</CardTitle>
          <CardDescription>
            Choose your name from the list to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or SPU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-staff"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredStaff.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No staff members found</p>
                  </div>
                ) : (
                  filteredStaff.map((staff) => (
                    <Card
                      key={staff.id}
                      className="hover-elevate cursor-pointer transition-colors"
                      onClick={() => onStaffSelected(staff)}
                      data-testid={`card-staff-${staff.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base mb-1" data-testid={`text-name-${staff.id}`}>
                              {staff.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-1" data-testid={`text-email-${staff.id}`}>
                              {staff.email}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="text-xs bg-muted px-2 py-1 rounded-md" data-testid={`text-spu-${staff.id}`}>
                                {staff.spu.name}
                              </span>
                              {staff.subUnit && (
                                <span className="text-xs bg-muted px-2 py-1 rounded-md" data-testid={`text-subunit-${staff.id}`}>
                                  {staff.subUnit.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" data-testid={`button-select-${staff.id}`}>
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
