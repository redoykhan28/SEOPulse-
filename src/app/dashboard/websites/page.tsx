import { redirect } from "next/navigation";

export default function WebsitesPage() {
  // The main dashboard already serves as the websites list
  // Redirect to avoid a 404 when clicking the Sidebar link
  redirect("/dashboard");
}
