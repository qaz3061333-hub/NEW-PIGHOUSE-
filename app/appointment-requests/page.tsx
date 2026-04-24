import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { appointmentRequests } from "@/lib/mockData";

export default function AppointmentRequestsPage() {
  return (
    <PageShell title="Appointment Requests 預約申請" description="顯示來自 LINE 的預約申請（目前為 mock data）。">
      <SimpleTable headers={["申請編號", "寵物", "服務", "飼主", "申請時間", "狀態"]}>
        {appointmentRequests.map((request) => (
          <tr key={request.id}>
            <td className="px-4 py-3">{request.id}</td>
            <td className="px-4 py-3">{request.petName}</td>
            <td className="px-4 py-3">{request.service}</td>
            <td className="px-4 py-3">{request.ownerName}</td>
            <td className="px-4 py-3">{request.requestedAt}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{request.status}</span>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </PageShell>
  );
}
