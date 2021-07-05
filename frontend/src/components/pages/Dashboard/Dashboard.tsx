import axios from "axios";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";
import React from "react";
import assertNever from "../../../utils/assertNever";
import endpoint from "../../../utils/endpoint";
import ErrorView from "./views/ErrorView";
import LoadingView from "./views/LoadingView";
import TableView from "./views/TableView";

const resType = t.type({
    year: t.number,
    caregivers: t.array(
        t.type({
            name: t.string,
            patients: t.array(t.string)
        })
    )
});

export type Report = t.TypeOf<typeof resType>;

type State =
    | {
          type: "Initial";
      }
    | {
          type: "Resolved";
          report: Report;
          isRefreshing: boolean;
      }
    | {
          type: "Rejected";
          error: string;
      };

function useDashboard(params: { year: number }) {
    const [state, setState] = React.useState<State>({ type: "Initial" });

    const startLoading = () => {
        setState((prevState) => {
            switch (prevState.type) {
                case "Initial":
                case "Rejected":
                    return { type: "Initial" };
                case "Resolved":
                    return { ...prevState, isRefreshing: true };
            }
        });
    };

    const sortCaregivers = (careGivers: Array<any>) => {
        let sortedCareGivers: Array<any> = [];
        for(let i = 0; i < careGivers.length; i++){
            if(!sortedCareGivers.find(cg => cg.name === careGivers[i].name)){
                sortedCareGivers.push(careGivers[i]);
            }
            else{
                let careGiverIdx = sortedCareGivers.findIndex(cg => cg.name === careGivers[i].name);
                sortedCareGivers[careGiverIdx].patients = sortedCareGivers[careGiverIdx].patients.concat(careGivers[i].patients);
            }
        }
        return sortedCareGivers;
    }

    const fetchReport = React.useCallback(async () => {
        startLoading();
        console.log(state.type)

        return await axios
            .get<unknown>(endpoint(`reports/${params.year}`))
            .then((response) => {
                if (!resType.is(response.data)) {
                    console.error(PathReporter.report(resType.decode(response)).join(", "));
                    throw new Error("Error");
                }
                let sortedCareGivers = sortCaregivers(response.data.caregivers);
                let report = {...response.data, caregivers: sortedCareGivers};
                setState({ type: "Resolved", report: report, isRefreshing: false });
            })
            .catch(() => {
                setState({ type: "Rejected", error: "Error" });
            });
    }, [params.year]);

    React.useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return { state, actions: { fetchReport } };
}


const Dashboard = () => {
    const { state, actions } = useDashboard({ year: 2021 });

    const refreshReport = () => {
        actions.fetchReport();
    }

    switch (state.type) {
        case "Initial":
            return <LoadingView />;
        case "Rejected":
            return <ErrorView message={state.error} onClickRetry={actions.fetchReport} />;
        case "Resolved":
            return <TableView {...state} onClickRefresh={refreshReport}/>;
        default:
            assertNever(state);
            return <></>;
    }
};

export default Dashboard;
