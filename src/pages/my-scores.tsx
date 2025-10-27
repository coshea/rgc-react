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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  getGolferScores,
  getGolferInfo,
  type GHINScore,
  type GHINGolfer,
} from "@/api/ghin";

export default function MyScoresPage() {
  const { userProfile } = useUserProfile();

  const [ghinNumber, setGhinNumber] = useState("");
  const [golferInfo, setGolferInfo] = useState<GHINGolfer | null>(null);
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
  const [scoreCount, setScoreCount] = useState(20);
  const [ghinEmail, setGhinEmail] = useState("");
  const [ghinPassword, setGhinPassword] = useState("");
  const [ghinToken, setGhinToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Load GHIN number from user profile if available
  useEffect(() => {
    if (userProfile?.ghinNumber) {
      setGhinNumber(userProfile.ghinNumber);
    }
  }, [userProfile]);

  const handleGHINLogin = async () => {
    if (!ghinEmail.trim() || !ghinPassword.trim()) {
      setError("Please enter your GHIN email and password");
      return;
    }

    setLoggingIn(true);
    setError(null);

    try {
      const { loginToGHIN } = await import("@/api/ghin");
      const result = await loginToGHIN(ghinEmail, ghinPassword);

      if (result.error || !result.token) {
        setError(
          result.error || "Login failed. Please check your credentials."
        );
        setIsLoggedIn(false);
      } else {
        setGhinToken(result.token);
        setIsLoggedIn(true);
        setError(null);
        setLoginModalOpen(false); // Close modal on successful login
      }
    } catch (err) {
      setError("Failed to login to GHIN. Please try again.");
      console.error(err);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleFetchScores = async () => {
    if (!ghinNumber.trim()) {
      setError("Please enter a GHIN number");
      return;
    }

    if (!isLoggedIn || !ghinToken) {
      setError("Please login to GHIN first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch golfer info
      const info = await getGolferInfo(ghinNumber, ghinToken);
      if (info) {
        setGolferInfo(info);
      }

      // Fetch scores
      const scoresData = await getGolferScores(
        ghinNumber,
        scoreCount,
        ghinToken
      );

      // Filter by date if specified
      let filteredScores = scoresData;
      if (startDate || endDate) {
        filteredScores = scoresData.filter((score) => {
          const scoreDate = new Date(score.playedAt);
          if (startDate && scoreDate < new Date(startDate)) return false;
          if (endDate && scoreDate > new Date(endDate)) return false;
          return true;
        });
      }

      setScores(filteredScores);

      if (filteredScores.length === 0) {
        setError("No scores found for this golfer");
      }
    } catch (err) {
      setError(
        "Failed to fetch scores. Please check the GHIN number and try again."
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

      {/* GHIN Login */}
      {!isLoggedIn && (
        <Card className="mb-6">
          <CardBody className="text-center py-8">
            <Icon
              icon="lucide:lock"
              className="w-16 h-16 mx-auto mb-4 text-warning"
            />
            <h3 className="text-xl font-semibold mb-2">GHIN Login Required</h3>
            <p className="text-default-600 mb-4">
              To access score data, you need to login with your GHIN
              credentials.
            </p>
            <Button
              color="primary"
              size="lg"
              onPress={() => setLoginModalOpen(true)}
              startContent={<Icon icon="lucide:log-in" />}
            >
              Login to GHIN
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <h2 className="text-xl font-semibold">Search Scores</h2>
            {isLoggedIn && (
              <div className="flex items-center gap-2">
                <Chip color="success" variant="flat" size="sm">
                  <Icon icon="lucide:check-circle" className="mr-1" />
                  Logged In
                </Chip>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => {
                    setIsLoggedIn(false);
                    setGhinToken(null);
                    setGhinEmail("");
                    setGhinPassword("");
                    setScores([]);
                    setGolferInfo(null);
                  }}
                  startContent={<Icon icon="lucide:log-out" />}
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
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
              value={scoreCount.toString()}
              onChange={(e) => setScoreCount(parseInt(e.target.value) || 20)}
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

      {/* Golfer Info */}
      {golferInfo && (
        <Card className="mb-6">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-default-500">Name</p>
                <p className="text-lg font-semibold">
                  {golferInfo.firstName} {golferInfo.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-default-500">GHIN Number</p>
                <p className="text-lg font-semibold">{golferInfo.ghinNumber}</p>
              </div>
              {golferInfo.handicapIndex !== undefined && (
                <div>
                  <p className="text-sm text-default-500">Handicap Index</p>
                  <p className="text-lg font-semibold text-primary">
                    {golferInfo.handicapIndex.toFixed(1)}
                  </p>
                </div>
              )}
              {golferInfo.clubName && (
                <div>
                  <p className="text-sm text-default-500">Club</p>
                  <p className="text-lg font-semibold">{golferInfo.clubName}</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

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

      {/* GHIN Login Modal */}
      <Modal
        isOpen={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="lg"
        className="mx-4"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:lock" className="w-5 h-5 text-primary" />
                  <span>GHIN Login</span>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4">
                <p className="text-sm text-default-600">
                  Enter your GHIN credentials to access your score history.
                </p>
                <Input
                  label="GHIN Email"
                  placeholder="Enter your GHIN email"
                  type="email"
                  value={ghinEmail}
                  onChange={(e) => setGhinEmail(e.target.value)}
                  startContent={<Icon icon="lucide:mail" />}
                  isRequired
                  autoFocus
                />
                <Input
                  label="GHIN Password"
                  placeholder="Enter your GHIN password"
                  type="password"
                  value={ghinPassword}
                  onChange={(e) => setGhinPassword(e.target.value)}
                  startContent={<Icon icon="lucide:key" />}
                  isRequired
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loggingIn) {
                      handleGHINLogin();
                    }
                  }}
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
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  variant="flat"
                  onPress={onClose}
                  isDisabled={loggingIn}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleGHINLogin}
                  isLoading={loggingIn}
                  startContent={
                    !loggingIn ? <Icon icon="lucide:log-in" /> : undefined
                  }
                >
                  {loggingIn ? "Logging in..." : "Login"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
