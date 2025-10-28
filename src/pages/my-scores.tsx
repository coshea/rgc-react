import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Input,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Skeleton,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getGolferScores, type GHINScore } from "@/api/ghin";

export default function MyScoresPage() {
  const { userProfile } = useUserProfile();

  const [ghinNumber, setGhinNumber] = useState("");
  const [scores, setScores] = useState<GHINScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [scoreLimit, setScoreLimit] = useState(25);
  const [ghinCookie, setGhinCookie] = useState<string | null>(() => {
    // Load from localStorage on mount
    return localStorage.getItem("ghin_cookie");
  });
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState("");

  // Load GHIN number from user profile if available
  useEffect(() => {
    if (userProfile?.ghinNumber) {
      setGhinNumber(userProfile.ghinNumber);
    }
  }, [userProfile]);

  const handleOpenGHINLogin = () => {
    window.open("https://www.ghin.com/login", "_blank", "width=800,height=600");
    setCookieModalOpen(true);
  };

  const handleSaveCookie = () => {
    if (!cookieInput.trim()) {
      setError("Please enter a cookie value");
      return;
    }
    setGhinCookie(cookieInput);
    localStorage.setItem("ghin_cookie", cookieInput);
    setCookieModalOpen(false);
    setError(null);
  };

  const handleClearCookie = () => {
    setGhinCookie(null);
    localStorage.removeItem("ghin_cookie");
    setScores([]);
  };

  const handleFetchScores = async () => {
    if (!ghinNumber.trim()) {
      setError("Please enter a GHIN number");
      return;
    }

    if (!ghinCookie) {
      setError("Please login to GHIN first to obtain a session cookie");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch scores using the new endpoint with cookie
      const scoresData = await getGolferScores({
        golferId: ghinNumber,
        startDate,
        endDate,
        limit: scoreLimit,
        offset: 0,
        statuses: "Validated",
        cookie: ghinCookie,
      });

      setScores(scoresData);

      if (scoresData.length === 0) {
        setError("No scores found for this golfer");
      }
    } catch (err) {
      setError(
        "Failed to fetch scores. Please check the GHIN number and try again, or update your login cookie."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getScoreDifferentialColor = (
    diff: number
  ): "success" | "warning" | "danger" | "default" => {
    if (diff < 0) return "success";
    if (diff < 5) return "default";
    if (diff < 10) return "warning";
    return "danger";
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Icon icon="lucide:bar-chart-3" className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">My Scores</h1>
        </div>
        <p className="text-default-600">
          View your GHIN score history and track your performance
        </p>
      </div>

      {/* GHIN Login Status */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon
                icon={
                  ghinCookie ? "lucide:check-circle" : "lucide:alert-circle"
                }
                className={`w-6 h-6 ${ghinCookie ? "text-success" : "text-warning"}`}
              />
              <div>
                <p className="font-semibold">
                  {ghinCookie ? "GHIN Session Active" : "GHIN Login Required"}
                </p>
                <p className="text-sm text-default-500">
                  {ghinCookie
                    ? "You can now search for scores"
                    : "Login to GHIN to access score data"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {ghinCookie ? (
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={handleClearCookie}
                  startContent={<Icon icon="lucide:log-out" />}
                >
                  Clear Session
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleOpenGHINLogin}
                  startContent={<Icon icon="lucide:log-in" />}
                >
                  Login to GHIN
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Search Scores</h2>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Input
              label="GHIN Number"
              placeholder="Enter GHIN #"
              value={ghinNumber}
              onChange={(e) => setGhinNumber(e.target.value)}
              startContent={<Icon icon="lucide:user" />}
              isRequired
            />
            <Input
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              startContent={<Icon icon="lucide:calendar" />}
            />
            <Input
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              startContent={<Icon icon="lucide:calendar" />}
            />
            <Input
              type="number"
              label="Number of Scores"
              value={scoreLimit.toString()}
              onChange={(e) => setScoreLimit(parseInt(e.target.value) || 25)}
              min={1}
              max={100}
              startContent={<Icon icon="lucide:hash" />}
            />
          </div>

          <Button
            color="primary"
            onPress={handleFetchScores}
            isLoading={loading}
            startContent={!loading ? <Icon icon="lucide:search" /> : undefined}
          >
            {loading ? "Fetching Scores..." : "Search"}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-danger-50 dark:bg-danger-900/20 text-danger rounded-lg flex items-start gap-2">
              <Icon
                icon="lucide:alert-circle"
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <p>{error}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Scores Table */}
      {loading ? (
        <Card>
          <CardBody className="gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </CardBody>
        </Card>
      ) : scores.length > 0 ? (
        <Card>
          <CardBody className="p-0">
            <Table aria-label="Score history table">
              <TableHeader>
                <TableColumn>DATE</TableColumn>
                <TableColumn>COURSE</TableColumn>
                <TableColumn>SCORE</TableColumn>
                <TableColumn>ADJ. GROSS</TableColumn>
                <TableColumn>RATING/SLOPE</TableColumn>
                <TableColumn>DIFFERENTIAL</TableColumn>
                <TableColumn>TYPE</TableColumn>
              </TableHeader>
              <TableBody>
                {scores.map((score, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDate(score.playedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{score.courseName}</span>
                        {score.teeSet && (
                          <span className="text-xs text-default-500">
                            {score.teeSet}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{score.score}</span>
                      {score.holes === 9 && (
                        <Chip size="sm" variant="flat" className="ml-2">
                          9H
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell>{score.adjustedGrossScore}</TableCell>
                    <TableCell>
                      {score.courseRating.toFixed(1)} / {score.slopeRating}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={getScoreDifferentialColor(
                          score.scoreDifferential
                        )}
                        variant="flat"
                      >
                        {score.scoreDifferential.toFixed(1)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {score.type || "Regular"}
                      {score.revisionScore && (
                        <Chip
                          size="sm"
                          color="warning"
                          variant="flat"
                          className="ml-1"
                        >
                          Rev
                        </Chip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      ) : null}

      {/* Summary Stats (if scores loaded) */}
      {scores.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Summary Statistics</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {scores.length}
                </p>
                <p className="text-sm text-default-500">Total Scores</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">
                  {(
                    scores.reduce((sum, s) => sum + s.score, 0) / scores.length
                  ).toFixed(1)}
                </p>
                <p className="text-sm text-default-500">Avg Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">
                  {Math.min(...scores.map((s) => s.score))}
                </p>
                <p className="text-sm text-default-500">Best Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">
                  {(
                    scores.reduce((sum, s) => sum + s.scoreDifferential, 0) /
                    scores.length
                  ).toFixed(1)}
                </p>
                <p className="text-sm text-default-500">Avg Differential</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cookie Input Modal */}
      <Modal
        isOpen={cookieModalOpen}
        onOpenChange={setCookieModalOpen}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:cookie" className="w-5 h-5 text-primary" />
                  <span>Enter GHIN Session Cookie</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Icon icon="lucide:info" className="w-4 h-4" />
                      Instructions:
                    </p>
                    <ol className="text-sm space-y-2 list-decimal list-inside text-default-700">
                      <li>A new window should have opened to ghin.com</li>
                      <li>Log in with your GHIN credentials</li>
                      <li>
                        Open browser Developer Tools (F12 or Right-click →
                        Inspect)
                      </li>
                      <li>Go to the "Application" or "Storage" tab</li>
                      <li>Click "Cookies" → "https://www.ghin.com"</li>
                      <li>Find the cookie named "GHIN2020_api2_production"</li>
                      <li>
                        Copy ONLY the VALUE (not the name) - double-click the
                        value to select it
                      </li>
                      <li>Paste it in the field below</li>
                    </ol>
                  </div>

                  <Textarea
                    label="Cookie Value"
                    placeholder="Paste only the cookie VALUE here (not GHIN2020_api2_production=...)"
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    minRows={4}
                    description="Should be a long encoded string like: JkpK%2B%2Fpk0%2F4F... (without 'GHIN2020_api2_production=')"
                  />

                  {error && (
                    <div className="p-3 bg-danger-50 dark:bg-danger-900/20 text-danger rounded-lg flex items-start gap-2">
                      <Icon
                        icon="lucide:alert-circle"
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                      />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSaveCookie}
                  startContent={<Icon icon="lucide:save" />}
                >
                  Save Cookie
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
