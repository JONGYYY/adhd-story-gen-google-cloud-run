'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Video, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { cn } from '../../lib/utils';
import type { DayProps } from 'react-day-picker';

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState([
    {
      id: 1,
      title: 'The Wedding Dress Disaster',
      date: '2024-03-18',
      time: '18:00',
      platform: 'youtube',
      thumbnail: '/thumbnails/video1.jpg',
    },
    {
      id: 2,
      title: 'My Neighbor\'s Secret Garden',
      date: '2024-03-18',
      time: '20:00',
      platform: 'tiktok',
      thumbnail: '/thumbnails/video2.jpg',
    },
  ]);

  const hasEventsOnDate = (date: Date) => {
    return events.some(
      (event) => event.date === format(date, 'yyyy-MM-dd')
    );
  };

  const modifiers = {
    hasEvent: (date: Date) => hasEventsOnDate(date),
  };

  const modifiersClassNames = {
    hasEvent: 'bg-primary/10 text-primary relative',
    selected: 'bg-primary text-primary-foreground',
    today: 'bg-accent text-accent-foreground',
  };

  return (
    <>
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Content Schedule</h1>
            <Button asChild>
              <Link href="/create">Schedule New Video</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Calendar</h2>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiersClassNames={modifiersClassNames}
                components={{
                  Day: ({ day, ...props }: DayProps) => (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div {...props} />
                      {day && hasEventsOnDate(day.date) && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                          <div className="w-1 h-1 rounded-full bg-primary"></div>
                        </div>
                      )}
                    </div>
                  )
                }}
                className="p-3"
              />
            </div>

            {/* Events for Selected Date */}
            <div className="mt-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4 text-white">
                  {selectedDate
                    ? format(selectedDate, 'MMMM d, yyyy')
                    : 'Select a Date'}
                </h2>
                <div className="space-y-4">
                  {selectedDate &&
                    events
                      .filter(
                        (event) => event.date === format(selectedDate, 'yyyy-MM-dd')
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center space-x-4 p-4 bg-gray-700 rounded-lg"
                        >
                          <div className="w-24 aspect-video rounded overflow-hidden">
                            <img
                              src={event.thumbnail}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white truncate">
                              {event.title}
                            </h3>
                            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                              <span>{event.time}</span>
                              <span className="capitalize">{event.platform}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      ))}
                  {selectedDate && !events.some(event => event.date === format(selectedDate, 'yyyy-MM-dd')) && (
                    <p className="text-gray-400 text-center py-4">
                      No videos scheduled for this date
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4 text-white">Quick Actions</h2>
              <div className="space-y-3">
                <Button className="w-full" asChild>
                  <Link href="/create">Schedule New Video</Link>
                </Button>
                <Button variant="outline" className="w-full">
                  View All Scheduled
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 