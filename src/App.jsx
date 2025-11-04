import React, { useState, useEffect, useRef } from "react";
import "./App.css"; 
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error) => {
      console.error('Error caught:', error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return <div>Something went wrong. Check the console.</div>;
  }
  
  return children;
};

// SortableTask component
function SortableTask({task, onToggleRunning, onReset, onRemove}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: task.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="task-box"
    >
      <div {...listeners} style={{ cursor: 'grab', flex: 1}}>
        <strong>{task.name}</strong> ... {formatTime(task.timeLeft)}
      </div>
      
      <div style={{display: 'flex', gap:'8px'}}>
        <button
          className="task-button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRunning(task.id);
          }}
        >
          {task.running ? "Pause" : "Start"}
        </button>
        <button
          className="task-button"
          onClick={(e) => {
            e.stopPropagation();
            onReset(task.id);
          }}
        >
          Reset
        </button>
        <button
          className="task-button remove-button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(task.id);
          }}

        >
          x
        </button>
      </div>
    </div>
  );
}


function formatTime(seconds) {
    const totalMinutes = Math.floor(seconds/60);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes/60);
      const minutes = totalMinutes % 60;
      const remainingSeconds = seconds % 60;

      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2,"0")}`; 
      
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    
  }
  
function App() {
  const [task, setTask] = useState(""); 
  const [tasks, setTasks] = useState([]); 
  const [minutes, setMinutes] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [autoPlay, setAutoplay] = useState(false);
  const taskInputRef = useRef(null);
  const minutesInputRef = useRef(null);
  const addButtonRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const {active, over} = event;

    if (active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Remove the old drag-related code:
  // - taskRefs
  // - getTaskRef function  
  // - TASK_HEIGHT constant
  // - getTaskPosition function
  // - old handleDrop function

  //debugging
  useEffect(() => {
    console.log("Tasks updated:", tasks);
    console.log("Number of tasks", tasks.length);

    tasks.forEach((t, index) => {
      if (!t.id || !t.name) {
        console.error('Invalid task at index ', {index}, ' :', t);
      }
    })
  }, [tasks]);
  
  useEffect(() => {
    if (darkMode) {
      document.body.style.backgroundColor = "#121212";
      document.body.style.color = "#f5f5f5";
    } else {
      document.body.style.backgroundColor = "#f5f5f5";
      document.body.style.color = "#222";
    }
  }, [darkMode]);

  useEffect(() => {
    taskInputRef.current?.focus();
  }, []);

  
  useEffect(() => {
  const intervalId = setInterval(() => {
    setTasks(prevTasks => {
      // return early if no tasks running
      if (!prevTasks.some(task => task.running && task.timeLeft > 0)) {
        return prevTasks;
      }
      
      let shouldStartNextTask = false;

      const updatedTasks = prevTasks.map(task => {
        if (task.running && task.timeLeft > 0) {
          const newTimeLeft = task.timeLeft - 1;
          const isCompleted = newTimeLeft === 0;

          if (isCompleted && autoPlay) {
            shouldStartNextTask = true;
          }
          return { ...task, timeLeft: newTimeLeft, completed: isCompleted};
        }
        return task;
      });

      // Handle autoplay separately to avoid complexity
      if (shouldStartNextTask && autoPlay) {
          const currentRunningIndex = prevTasks.findIndex(t => t.running && t.timeLeft === 1);
          if (currentRunningIndex !== -1) {
            // Stop the completed task
            updatedTasks[currentRunningIndex] = {
              ...updatedTasks[currentRunningIndex],
              running: false
            };
            
            // Start the next available task
            const nextTaskIndex = currentRunningIndex + 1;
            if (nextTaskIndex < updatedTasks.length && updatedTasks[nextTaskIndex].timeLeft > 0) {
              updatedTasks[nextTaskIndex] = {
                ...updatedTasks[nextTaskIndex],
                running: true
              };
            }
          }
        }

        return updatedTasks;
    });
  }, 1000);
  
  return () => clearInterval(intervalId);
  }, [autoPlay, tasks]);


  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tasks'));
      console.log("Loaded from localStorage:", saved);

      if (Array.isArray(saved) && saved.length > 0) {
        // Ensure every task has required properties
        const validated = saved.map(t => ({
          id: t.id,
          name: t.name || "Unnamed Task",
          minutes: t.minutes || 1,
          timeLeft: t.timeLeft !== undefined ? t.timeLeft : (t.minutes || 1) * 60,
          running: false,
          completed: t.completed || false,
          mode: t.mode || "countdown",
        }));
        setTasks(validated);
        console.log("Validated tasks: ", validated);
      }
    } catch (e) {
        console.error("Failed to load saved tasks:", e);
        localStorage.removeItem('tasks');
      }
    }, []);


  //wanna make sure tasks are actually being loaded
  useEffect(() => {
    console.log("Tasks after loading or update:", tasks, "Length:", tasks.length);
  }, [tasks]);

  function addTask() { 
    const trimmedTask = task.trim();
    const numMinutes = Number(minutes);

    console.log("addTask called with:", {trimmedTask, numMinutes}); //debug
    
    if (!trimmedTask || numMinutes <= 0 || isNaN(numMinutes)) return;
    
    const newTask = {
      id: Date.now(),
      name: trimmedTask,
      minutes: numMinutes,
      timeLeft: numMinutes * 60,
      running: false,
      completed: false,
      mode: "countdown",
    };

    console.log("Creating new task:", newTask); //debug

    setTasks(prev => {
      const newTasks = [...prev, newTask];
      console.log( "New tasks array will be:", newTasks);
      return newTasks;
    });

    setTask(""); 
    setMinutes("");
    taskInputRef.current?.focus();
  }

  //local storage for tasks
  useEffect(() => {
    console.log("Saving to localStorage: ", tasks);
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  function removeTask(id) {
   setTasks(prev => prev.filter(t => t.id !== id));
  }

  function toggleRunning(id) {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          return { ...t, running: !t.running };
        } 
        if (autoPlay && !t.running) {
          return {...t, running:false};
        }
        return t;
      })
    );
  }

  function toggleAutoPlay() {
    setAutoplay(!autoPlay);
  }


  function resetTask(id){
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, timeLeft: t.minutes * 60, running: false} : t)
    );
  }

  function resetAllTask(){
    const updatedTasks = tasks.map(task => ({
      ...task,
        timeLeft: task.minutes * 60,
        running:false
    }))
    setTasks(updatedTasks);
  }

  return (
    <ErrorBoundary>
      <div className={darkMode ? "app dark" : "app light"}>
      
        <header className="app-header">
          <h1>⏳ Time Manager</h1>
        </header>

        <button 
          className="dark-mode-button"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        <button 
          className="button"
          onClick={toggleAutoPlay}
        >
          {autoPlay ? "Auto-Play : ON" : "Auto-Play: OFF"}
        </button>

        <button 
          className="button"
          onClick={() => resetAllTask()}
        > 
        Reset All
        </button>

        <main className="app-content">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
          >
            <input
              ref={taskInputRef}
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Enter a task"
              onKeyDown={(e) => {
                if (e.key === "Enter" && task.trim()) {
                  e.preventDefault();
                  minutesInputRef.current.focus();
                }
              }}
            />

            <input
              ref={minutesInputRef}
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Minutes"
              min="1"
              max="1440"
            />
            <button 
              ref = {addButtonRef}
              type="submit"
              className="button"
              disabled={!task.trim() || Number(minutes) <= 0 || isNaN(Number(minutes))}
            >
              Add Task
            </button>
          </form>

          {(!task.trim() || minutes <= 0 || isNaN(minutes)) && (
            <p style={{ color: "gray", fontSize: "0.9em" }}>
              Please enter a task name and allotted time.
            </p>
          )}
    
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
              <div style={{ listStyle: "none", padding: 0 }}>
                {tasks.map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    onToggleRunning={toggleRunning}
                    onReset={resetTask}
                    onRemove={removeTask}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;