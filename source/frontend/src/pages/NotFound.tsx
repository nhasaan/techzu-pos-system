import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import { buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <Card className="max-w-sm text-center">
        <CardHeader>
          <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
          <CardTitle className="text-2xl">404</CardTitle>
          <CardDescription>Page not found.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className={cn(buttonVariants(), 'gap-2 inline-flex')}>
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
