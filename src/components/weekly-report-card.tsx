import { FileTextIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function WeeklyReportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Report</CardTitle>
        <CardDescription>A recap of your week, generated automatically</CardDescription>
      </CardHeader>
      <CardContent>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>Coming soon</EmptyTitle>
            <EmptyDescription>Weekly recaps of your matchup, roster moves, and standings will show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
