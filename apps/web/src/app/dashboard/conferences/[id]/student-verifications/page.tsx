import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentVerificationsRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/conferences/${id}/registrations/verifications`);
}
