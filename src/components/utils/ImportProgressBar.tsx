interface ImportProgressBarProps {
  progress: number;
}

export default function ImportProgressBar({ progress }: ImportProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 w-full z-50">
      <div className="h-2 bg-blue-200 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-blue-700 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-center text-xs font-medium text-blue-900 bg-white py-0.5 shadow">
        Importation en cours… {progress}%
      </div>
    </div>
  );
}
