import { Mail, MapPin } from "lucide-react";

export default async function ContactPage() {

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
        <div className="space-y-6">
          <p className="text-lg text-muted-foreground">
            Have questions or feedback? We&apos;d love to hear from you.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border p-6">
              <Mail className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Email</h3>
              <p className="text-sm text-muted-foreground">support@turgo.io</p>
            </div>
            <div className="rounded-xl border p-6">
              <MapPin className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Location</h3>
              <p className="text-sm text-muted-foreground">Baltic Region (LV, LT, EE)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
