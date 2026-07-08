import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MembersDirectoryPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/conferences/${id}/members/organisers`);
}
