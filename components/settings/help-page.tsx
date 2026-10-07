import PageHeader from "@/components/crm/page-header";

export default function HelpPage() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="Help" description="How this CRM is organized" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {[
            ["Companies", "Accounts you are selling to or managing."],
            ["Contacts", "People connected to those companies."],
            ["Deals", "Commercial opportunities grouped into pipelines and stages."],
            ["Activities", "Calls, meetings, notes, emails and follow-up tasks."],
            ["Email Sequences", "Stored outreach plans and contact enrollments."],
            ["MCP", "Connect ChatGPT or another MCP client from Workspace Settings using an access token."],
          ].map(([title, body]) => (
            <article
              key={title}
              className="border-line-strong bg-card rounded-xl border p-4"
            >
              <h2>{title}</h2>
              <p className="text-soft mt-2 leading-5">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
