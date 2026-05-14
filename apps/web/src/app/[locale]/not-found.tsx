import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-3xl font-bold">404</h2>
      <p className="text-muted-foreground">Page not found</p>
      <Button asChild>
        <Link href="/reports">Go to Reports</Link>
      </Button>
    </div>
  )
}
