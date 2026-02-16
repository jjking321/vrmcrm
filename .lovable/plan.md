

# Add "Buying Property" Pipeline Stage

## What Will Happen

A new pipeline stage called "Buying Property" will be inserted between "Contacted" (sort_order 1) and "Meeting Scheduled" (sort_order 2). To make room, all stages from "Meeting Scheduled" onward will have their sort_order incremented by 1.

## Technical Details

A single database migration will:
1. Shift sort_order +1 for all stages with sort_order >= 2 (Meeting Scheduled through Abandoned)
2. Insert a new "Buying Property" stage with sort_order 2 and a distinct color (teal)

No frontend code changes are needed -- the pipeline UI already reads stages dynamically from the database.

