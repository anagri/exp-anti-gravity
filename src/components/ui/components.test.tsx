import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Card, CardContent, CardTitle } from './card';
import { Input } from './input';

describe('UI Components', () => {
  it('renders Button correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders Input correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders Card correctly', () => {
    render(
      <Card>
        <CardTitle>Card Title</CardTitle>
        <CardContent>Card Content</CardContent>
      </Card>
    );
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });
});
