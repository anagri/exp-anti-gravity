import { render, screen } from '@testing-library/react';
import { Button } from './button';
import { Input } from './input';
import { Card, CardTitle, CardContent } from './card';
import { describe, it, expect } from 'vitest';
import React from 'react';

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
